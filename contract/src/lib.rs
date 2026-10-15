use tari_template_lib::prelude::*;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

#[derive(Clone, Debug, minicbor::Encode, minicbor::Decode, minicbor::CborLen)]
pub struct Incubation {
    #[n(0)] pub owner: RistrettoPublicKeyBytes,
    #[n(1)] pub recipient: ComponentAddress,
    #[n(2)] pub door: u8,
    #[n(3)] pub commitment: String,
    #[n(4)] pub hatched: bool,
}

#[template]
mod midnight_kennel {
    use super::*;

    /// Cosmetic testnet collectibles. No token yield or fair-draw claims.
    pub struct MidnightKennel {
        resource: ResourceAddress,
        oracle: RistrettoPublicKeyBytes,
        requests: BTreeMap<String, Incubation>,
        per_owner: BTreeMap<RistrettoPublicKeyBytes, u32>,
        max_supply: u32,
        minted: u32,
    }

    impl MidnightKennel {
        pub fn new(max_supply: u32) -> Component<Self> {
            assert!(max_supply > 0 && max_supply <= 250, "Supply must be 1..250 for this PoC");
            let oracle = CallerContext::transaction_signer_public_key();
            let allocation = CallerContext::allocate_component_address(None);
            let address = allocation.get_address();
            let resource = ResourceBuilder::non_fungible()
                .with_token_symbol("HOWL")
                .metadata("name", "Midnight Kennel Canines")
                .metadata("description", "Spooky Secrets 2026: testnet canine incubation collectibles")
                .with_owner_rule(OwnerRule::None)
                .mintable(rule!(component(address)), LOCKED)
                .update_non_fungible_data(rule!(deny_all), LOCKED)
                .build();
            Component::new(Self {
                resource, oracle, requests: BTreeMap::new(), per_owner: BTreeMap::new(), max_supply, minted: 0,
            })
            .with_address_allocation(allocation)
            .with_owner_rule(OwnerRule::None)
            .with_access_rules(ComponentAccessRules::new()
                .method("begin_incubation", rule!(allow_all))
                .method("seal_incubation", rule!(public_key(oracle)))
                .method("hatch", rule!(allow_all))
                .method("get_incubation", rule!(allow_all))
                .method("get_resource", rule!(allow_all))
                .method("get_minted", rule!(allow_all)))
            .create()
        }

        /// Reserve one slot. Retrying the same id cannot mint or reserve twice.
        pub fn begin_incubation(&mut self, id: String, recipient: ComponentAddress, door: u8) {
            assert!(id.len() == 32 && id.bytes().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()), "Invalid incubation id");
            assert!(door < 3, "Invalid haunted door");
            assert!(!self.requests.contains_key(&id), "Incubation already exists");
            assert!(self.requests.len() < self.max_supply as usize, "Event is full");
            let owner = CallerContext::transaction_signer_public_key();
            let count = self.per_owner.entry(owner).or_insert(0);
            assert!(*count < 12, "Twelve incubations per account in this event");
            *count += 1;
            self.requests.insert(id.clone(), Incubation { owner, recipient, door, commitment: String::new(), hatched: false });
            emit_event("IncubationStarted", metadata!["id" => id, "recipient" => recipient.to_string()]);
        }

        /// The operator commits once, before delivering the opening via encrypted memo.
        pub fn seal_incubation(&mut self, id: String, commitment: String) {
            assert_eq!(CallerContext::transaction_signer_public_key(), self.oracle, "Operator only");
            assert!(commitment.len() == 64 && commitment.bytes().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()), "Invalid commitment");
            let request = self.requests.get_mut(&id).expect("Unknown incubation");
            assert!(request.commitment.is_empty() && !request.hatched, "Outcome already committed");
            request.commitment = commitment;
            emit_event("IncubationSealed", metadata!["id" => id]);
        }

        /// Revealing makes the outcome public. Mint + fixed-recipient deposit are atomic.
        pub fn hatch(&mut self, id: String, variant: u8, salt: String) {
            assert!(variant < 6, "Unknown canine variant");
            assert!(salt.len() == 64 && salt.bytes().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()), "Invalid opening salt");
            let request = self.requests.get_mut(&id).expect("Unknown incubation");
            assert_eq!(request.owner, CallerContext::transaction_signer_public_key(), "Only the incubator owner can hatch");
            assert!(!request.hatched, "Already hatched");
            assert!(!request.commitment.is_empty(), "Outcome not ready");
            let opening = format!("midnight-kennel:v1|{}|{}|{}", id, variant, salt);
            let actual = format!("{:x}", Sha256::digest(opening.as_bytes()));
            assert_eq!(request.commitment, actual, "Opening does not match committed outcome");
            request.hatched = true;
            let recipient = request.recipient;
            let names = ["Pumpkin Pup", "Moonlight Howler", "Candy Corn Corgi", "Boo Beagle", "Mummy Mutt", "Bat-Eared Bandit"];
            let genes = ["AAAABBBB", "BBBBAAAA", "CCCCAAAA", "DDDDBBBB", "EEEECCCC", "FFFFDDDD"];
            let outcome = if variant < 3 { "treat" } else { "trick" };
            let data = metadata![
                "name" => names[variant as usize].to_string(),
                "variant" => variant.to_string(),
                "genes" => genes[variant as usize].to_string(),
                "generation" => "0".to_string(),
                "parents" => "".to_string(),
                "origin" => "trick-or-treat-2026".to_string(),
                "outcome" => outcome.to_string(),
                "art_version" => "1".to_string(),
                "incubation_id" => id.clone(),
            ];
            let nft = ResourceManager::get(self.resource).mint_non_fungible(NonFungibleId::from_string(id.clone()), &data, &());
            self.minted += 1;
            ComponentManager::get(recipient).invoke("deposit", args![nft]);
            emit_event("CanineHatched", metadata!["id" => id, "recipient" => recipient.to_string(), "resource" => self.resource.to_string(), "variant" => variant.to_string()]);
        }

        pub fn get_incubation(&self, id: String) -> Option<Incubation> { self.requests.get(&id).cloned() }
        pub fn get_resource(&self) -> ResourceAddress { self.resource }
        pub fn get_minted(&self) -> u32 { self.minted }
    }
}
