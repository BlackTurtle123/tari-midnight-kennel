use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use tari_template_lib::prelude::*;
use tari_template_lib::types::constants::TARI_TOKEN;

#[derive(Clone, Debug, minicbor::Encode, minicbor::Decode, minicbor::CborLen)]
pub struct Rebirth {
    #[n(0)]
    pub owner: RistrettoPublicKeyBytes,
    #[n(1)]
    pub recipient: ComponentAddress,
    #[n(2)]
    pub source: ResourceAddress,
    #[n(3)]
    pub token: NonFungibleId,
    #[n(4)]
    pub target_epoch: u64,
    #[n(5)]
    pub status: u8,
    #[n(6)]
    pub reward: u8,
}
#[template]
mod arkimals_rebirth {
    use super::*;
    pub struct ArkimalsRebirth {
        resource: ResourceAddress,
        retired: BTreeMap<ResourceAddress, Vault>,
        staking: ComponentAddress,
        treasury: ComponentAddress,
        fee: u64,
        escrow: Vault,
        requests: BTreeMap<String, Rebirth>,
        epochs: BTreeMap<u64, String>,
        minted: u32,
    }
    impl ArkimalsRebirth {
        pub fn new(
            current: ResourceAddress,
            legacy: ResourceAddress,
            staking: ComponentAddress,
            treasury: ComponentAddress,
            fee: u64,
        ) -> Component<Self> {
            assert!(
                fee > 0 && fee <= 100_000_000 && fee % 4 == 0,
                "Invalid testnet fee"
            );
            let allocation = CallerContext::allocate_component_address(None);
            let address = allocation.get_address();
            let resource = ResourceBuilder::non_fungible()
                .with_token_symbol("BOO")
                .metadata("name", "Arkimals Halloween Rebirth")
                .metadata(
                    "description",
                    "Tari testnet editions of Arkimals Halloween artwork",
                )
                .with_owner_rule(OwnerRule::None)
                .mintable(rule!(component(address)), LOCKED)
                .update_non_fungible_data(rule!(deny_all), LOCKED)
                .build();
            let mut retired = BTreeMap::new();
            retired.insert(current, Vault::new_empty(current));
            if legacy != current {
                retired.insert(legacy, Vault::new_empty(legacy));
            }
            Component::new(Self {
                resource,
                retired,
                staking,
                treasury,
                fee,
                escrow: Vault::new_empty(TARI_TOKEN),
                requests: BTreeMap::new(),
                epochs: BTreeMap::new(),
                minted: 0,
            })
            .with_address_allocation(allocation)
            .with_owner_rule(OwnerRule::None)
            .with_access_rules(
                ComponentAccessRules::new()
                    .method("begin_rebirth", rule!(allow_all))
                    .method("capture_epoch", rule!(allow_all))
                    .method("finish_rebirth", rule!(allow_all))
                    .method("refund_missed_epoch", rule!(allow_all))
                    .method("get_resource", rule!(allow_all))
                    .method("get_requests", rule!(allow_all))
                    .method("get_epochs", rule!(allow_all))
                    .method("get_minted", rule!(allow_all)),
            )
            .create()
        }
        /// The paid sacrifice precedes its fixed future epoch; changing a transaction nonce cannot reroll it.
        pub fn begin_rebirth(
            &mut self,
            canine: Bucket,
            payment: Bucket,
            recipient: ComponentAddress,
        ) {
            let source = canine.resource_address();
            let vault = self
                .retired
                .get(&source)
                .expect("Only original Tari canine collections qualify");
            let ids = canine.get_non_fungible_ids();
            assert_eq!(ids.len(), 1, "Offer exactly one canine");
            assert_eq!(payment.resource_address(), TARI_TOKEN, "Pay in public TARI");
            assert_eq!(
                payment.amount(),
                Amount::from(self.fee),
                "Wrong rebirth fee"
            );
            let token = ids[0].clone();
            let id = format!(
                "{:x}",
                Sha256::digest(format!("arkimals:rebirth:v1|{source}|{token}"))
            );
            assert!(!self.requests.contains_key(&id), "Rebirth already started");
            assert!(self.requests.len() < 250, "Halloween event is full");
            let target_epoch = Consensus::current_epoch().checked_add(2).unwrap();
            self.requests.insert(
                id,
                Rebirth {
                    owner: CallerContext::transaction_signer_public_key(),
                    recipient,
                    source,
                    token,
                    target_epoch,
                    status: 0,
                    reward: 255,
                },
            );
            vault.deposit(canine);
            self.escrow.deposit(payment);
        }
        /// Permissionless keeper records consensus data only during the predetermined epoch.
        pub fn capture_epoch(&mut self) {
            let epoch = Consensus::current_epoch();
            assert!(
                self.requests
                    .values()
                    .any(|r| r.status == 0 && r.target_epoch == epoch),
                "No rebirth needs this epoch"
            );
            if !self.epochs.contains_key(&epoch) {
                self.epochs
                    .insert(epoch, Consensus::current_epoch_hash().to_string());
            }
        }
        /// Anyone may finish, but both the output account and the outcome were fixed by the original request.
        pub fn finish_rebirth(&mut self, id: String) {
            let target = self
                .requests
                .get(&id)
                .expect("Unknown rebirth")
                .target_epoch;
            if !self.epochs.contains_key(&target) && Consensus::current_epoch() == target {
                self.capture_epoch();
            }
            let r = self.requests.get_mut(&id).expect("Unknown rebirth");
            assert_eq!(r.status, 0, "Rebirth already resolved");
            let epoch_hash = self
                .epochs
                .get(&r.target_epoch)
                .expect("Future epoch has not been captured");
            let hash = Sha256::digest(format!("arkimals:draw:v1|{id}|{epoch_hash}"));
            let roll = u32::from_be_bytes(hash[..4].try_into().unwrap()) % 100;
            // Cat 30%, Ghosty 25%, Pumpkin 20%, Soul 15%, two jackpot editions 5% each.
            let reward: usize = if roll < 30 {
                0
            } else if roll < 35 {
                1
            } else if roll < 40 {
                2
            } else if roll < 65 {
                3
            } else if roll < 85 {
                4
            } else {
                5
            };
            let names = [
                "Haunted Cat",
                "Shadowfang",
                "Crest Mummy",
                "Ghosty",
                "Pumpkin Familiar",
                "Halloween Soul",
            ];
            let originals = [
                "ART-H26CAT",
                "CANI-WWWWWOLF-JU",
                "EAGL-WWWMUMMY-JU",
                "ART-GHOSTY",
                "ART-PUMPKIN",
                "ART-H26SOUL",
            ];
            let data = metadata!["name" => names[reward].to_string(), "reward" => reward.to_string(), "original" => originals[reward].to_string(), "edition" => "tari-halloween-2026".to_string(), "art_version" => "arkimals-halloween-v1".to_string(), "source_resource" => r.source.to_string(), "source_id" => r.token.to_string(), "rebirth_id" => id.clone(), "draw_epoch" => r.target_epoch.to_string(), "draw_hash" => epoch_hash.clone()];
            r.status = 1;
            r.reward = reward as u8;
            let nft = ResourceManager::get(self.resource).mint_non_fungible(
                NonFungibleId::from_string(id.clone()),
                &data,
                &(),
            );
            ComponentManager::get(r.recipient).invoke("deposit", args![nft]);
            ComponentManager::get(self.staking).invoke(
                "deposit_fees",
                args![self.escrow.withdraw(self.fee - self.fee / 4)],
            );
            ComponentManager::get(self.treasury)
                .invoke("deposit", args![self.escrow.withdraw(self.fee / 4)]);
            self.minted += 1;
            emit_event(
                "HalloweenRebirth",
                metadata!["id" => id, "reward" => reward.to_string()],
            );
        }
        /// If no one captured the scheduled epoch, return both assets. No alternative seed or later-epoch reroll.
        pub fn refund_missed_epoch(&mut self, id: String) {
            let r = self.requests.get_mut(&id).expect("Unknown rebirth");
            assert_eq!(
                r.owner,
                CallerContext::transaction_signer_public_key(),
                "Owner only"
            );
            assert_eq!(r.status, 0, "Rebirth already resolved");
            assert!(
                Consensus::current_epoch() > r.target_epoch
                    && !self.epochs.contains_key(&r.target_epoch),
                "Scheduled draw remains available"
            );
            r.status = 2;
            let nft = self
                .retired
                .get(&r.source)
                .unwrap()
                .withdraw_non_fungible(r.token.clone());
            ComponentManager::get(r.recipient).invoke("deposit", args![nft]);
            ComponentManager::get(r.recipient)
                .invoke("deposit", args![self.escrow.withdraw(self.fee)]);
        }
        pub fn get_resource(&self) -> ResourceAddress {
            self.resource
        }
        pub fn get_requests(&self) -> BTreeMap<String, Rebirth> {
            self.requests.clone()
        }
        pub fn get_epochs(&self) -> BTreeMap<u64, String> {
            self.epochs.clone()
        }
        pub fn get_minted(&self) -> u32 {
            self.minted
        }
    }
}
