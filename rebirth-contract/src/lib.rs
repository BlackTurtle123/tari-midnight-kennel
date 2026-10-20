use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use tari_template_lib::prelude::*;

#[template]
mod arkimals_rebirth {
    use super::*;

    /// A voluntary, one-for-one testnet exchange. Existing immutable collections
    /// are retired into vaults with no withdrawal method, rather than burnt.
    pub struct ArkimalsRebirth {
        resource: ResourceAddress,
        retired: BTreeMap<ResourceAddress, Vault>,
        minted: u32,
    }

    impl ArkimalsRebirth {
        pub fn new(current: ResourceAddress, legacy: ResourceAddress) -> Component<Self> {
            let allocation = CallerContext::allocate_component_address(None);
            let address = allocation.get_address();
            let resource = ResourceBuilder::non_fungible()
                .with_token_symbol("BOO")
                .metadata("name", "Arkimals Halloween Rebirth")
                .metadata("description", "Tari testnet editions of Arkimals Halloween artwork")
                .with_owner_rule(OwnerRule::None)
                .mintable(rule!(component(address)), LOCKED)
                .update_non_fungible_data(rule!(deny_all), LOCKED)
                .build();
            let mut retired = BTreeMap::new();
            retired.insert(current, Vault::new_empty(current));
            if legacy != current {
                retired.insert(legacy, Vault::new_empty(legacy));
            }
            Component::new(Self { resource, retired, minted: 0 })
                .with_address_allocation(allocation)
                .with_owner_rule(OwnerRule::None)
                .with_access_rules(ComponentAccessRules::new()
                    .method("rebirth", rule!(allow_all))
                    .method("get_resource", rule!(allow_all))
                    .method("get_minted", rule!(allow_all)))
                .create()
        }

        /// The account's authorized withdrawal supplies the actual NFT bucket.
        /// Retirement and reward deposit either both commit or both roll back.
        pub fn rebirth(&mut self, canine: Bucket, recipient: ComponentAddress, reward: u8) {
            assert!(reward < 3, "Unknown Halloween reward");
            let source = canine.resource_address();
            let vault = self.retired.get(&source).expect("Only original Tari canine collections qualify");
            let ids = canine.get_non_fungible_ids();
            assert_eq!(ids.len(), 1, "Offer exactly one canine");
            let source_id = ids[0].to_string();
            let id = format!("{:x}", Sha256::digest(format!("arkimals:rebirth:v1|{source}|{source_id}").as_bytes()));
            let names = ["Haunted Cat", "Shadowfang", "Crest Mummy"];
            let originals = ["ART-H26CAT", "CANI-WWWWWOLF-JU", "EAGL-WWWMUMMY-JU"];
            let data = metadata![
                "name" => names[reward as usize].to_string(),
                "reward" => reward.to_string(),
                "original" => originals[reward as usize].to_string(),
                "edition" => "tari-halloween-2026".to_string(),
                "art_version" => "arkimals-halloween-v1".to_string(),
                "source_resource" => source.to_string(),
                "source_id" => source_id,
                "rebirth_id" => id.clone(),
            ];
            vault.deposit(canine);
            let nft = ResourceManager::get(self.resource)
                .mint_non_fungible(NonFungibleId::from_string(id.clone()), &data, &());
            ComponentManager::get(recipient).invoke("deposit", args![nft]);
            self.minted += 1;
            emit_event("HalloweenRebirth", metadata![
                "id" => id, "recipient" => recipient.to_string(), "reward" => reward.to_string()
            ]);
        }
        pub fn get_resource(&self) -> ResourceAddress { self.resource }
        pub fn get_minted(&self) -> u32 { self.minted }
    }
}
