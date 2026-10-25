use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use tari_template_lib::prelude::*;
use tari_template_lib::types::constants::TARI_TOKEN;

#[derive(Clone, Debug, minicbor::Encode, minicbor::Decode, minicbor::CborLen)]
pub struct Parent {
    #[n(0)]
    pub resource: ResourceAddress,
    #[n(1)]
    pub token: NonFungibleId,
    #[n(2)]
    pub genes: String,
    #[n(3)]
    pub generation: u8,
}
#[derive(Clone, Debug, minicbor::Encode, minicbor::Decode, minicbor::CborLen)]
pub struct Breeding {
    #[n(0)]
    pub owner: RistrettoPublicKeyBytes,
    #[n(1)]
    pub recipient: ComponentAddress,
    #[n(2)]
    pub first: Parent,
    #[n(3)]
    pub second: Parent,
    #[n(4)]
    pub target_epoch: u64,
    #[n(5)]
    pub status: u8,
}
fn key(p: &Parent) -> String {
    format!("{}|{}", p.resource, p.token)
}
fn read_parent(bucket: &Bucket) -> Parent {
    let ids = bucket.get_non_fungible_ids();
    assert_eq!(ids.len(), 1, "Provide exactly one canine per parent");
    let resource = bucket.resource_address();
    let data: Metadata = ResourceManager::get(resource)
        .get_non_fungible(&ids[0])
        .get_data();
    let genes = data
        .get("genes")
        .expect("Canine genes missing")
        .decode::<String>()
        .unwrap();
    assert!(
        genes.len() == 8 && genes.bytes().all(|b| (b'A'..=b'H').contains(&b)),
        "Invalid canine genes"
    );
    let generation = data
        .get("generation")
        .unwrap()
        .decode::<String>()
        .unwrap()
        .parse::<u8>()
        .expect("Invalid generation");
    assert!(generation < 7, "Generation O cannot breed");
    Parent {
        resource,
        token: ids[0].clone(),
        genes,
        generation,
    }
}
#[template]
mod arkimals_breeding {
    use super::*;
    pub struct ArkimalsBreeding {
        resource: ResourceAddress,
        vaults: BTreeMap<ResourceAddress, Vault>,
        treasury: ComponentAddress,
        fee: u64,
        escrow: Vault,
        requests: BTreeMap<String, Breeding>,
        parents: BTreeMap<String, String>,
        epochs: BTreeMap<u64, String>,
        minted: u32,
    }
    impl ArkimalsBreeding {
        pub fn new(
            current: ResourceAddress,
            legacy: ResourceAddress,
            treasury: ComponentAddress,
            fee: u64,
        ) -> Component<Self> {
            assert!(
                fee > 0 && fee <= 100_000_000,
                "Invalid staging breeding fee"
            );
            let allocation = CallerContext::allocate_component_address(None);
            let resource = ResourceBuilder::non_fungible()
                .with_token_symbol("CANI")
                .metadata("name", "Arkimals Bred Canines")
                .metadata("rules", "main-game-canine-breeding-2026-10-20")
                .with_owner_rule(OwnerRule::None)
                .mintable(rule!(component(allocation.get_address())), LOCKED)
                .update_non_fungible_data(rule!(deny_all), LOCKED)
                .build();
            let mut vaults = BTreeMap::new();
            for r in [current, legacy, resource] {
                vaults.entry(r).or_insert_with(|| Vault::new_empty(r));
            }
            Component::new(Self {
                resource,
                vaults,
                treasury,
                fee,
                escrow: Vault::new_empty(TARI_TOKEN),
                requests: BTreeMap::new(),
                parents: BTreeMap::new(),
                epochs: BTreeMap::new(),
                minted: 0,
            })
            .with_address_allocation(allocation)
            .with_owner_rule(OwnerRule::None)
            .with_access_rules(
                ComponentAccessRules::new()
                    .method("begin_breeding", rule!(allow_all))
                    .method("finish_breeding", rule!(allow_all))
                    .method("refund_missed_epoch", rule!(allow_all))
                    .method("capture_epoch", rule!(allow_all))
                    .method("get_resource", rule!(allow_all))
                    .method("get_requests", rule!(allow_all))
                    .method("get_parents", rule!(allow_all))
                    .method("get_minted", rule!(allow_all)),
            )
            .create()
        }
        pub fn begin_breeding(
            &mut self,
            first: Bucket,
            second: Bucket,
            payment: Bucket,
            recipient: ComponentAddress,
        ) {
            assert!(
                self.vaults.contains_key(&first.resource_address())
                    && self.vaults.contains_key(&second.resource_address()),
                "Unsupported canine collection"
            );
            let a = read_parent(&first);
            let b = read_parent(&second);
            let ak = key(&a);
            let bk = key(&b);
            assert_ne!(ak, bk, "Choose two different canines");
            assert!(
                !self.parents.contains_key(&ak) && !self.parents.contains_key(&bk),
                "A parent has already bred or is reserved"
            );
            assert_eq!(payment.resource_address(), TARI_TOKEN, "Use public TARI");
            assert_eq!(
                payment.amount(),
                Amount::from(self.fee),
                "Incorrect breeding fee"
            );
            // Canonical pair order prevents swapping parents to create another attempt.
            let pair = if ak < bk {
                format!("{ak}|{bk}")
            } else {
                format!("{bk}|{ak}")
            };
            let id = format!(
                "{:x}",
                Sha256::digest(format!("arkimals:breeding:v1|{pair}"))
            );
            assert!(
                !self.requests.contains_key(&id),
                "This pair already has a breeding attempt"
            );
            assert!(
                self.requests.len() < 1000,
                "Breeding release capacity reached"
            );
            self.parents.insert(ak, id.clone());
            self.parents.insert(bk, id.clone());
            self.requests.insert(
                id.clone(),
                Breeding {
                    owner: CallerContext::transaction_signer_public_key(),
                    recipient,
                    first: a,
                    second: b,
                    target_epoch: Consensus::current_epoch().checked_add(2).unwrap(),
                    status: 0,
                },
            );
            self.vaults[&first.resource_address()].deposit(first);
            self.vaults[&second.resource_address()].deposit(second);
            self.escrow.deposit(payment);
            emit_event("BreedingStarted", metadata!["id" => id]);
        }
        pub fn capture_epoch(&mut self) {
            let epoch = Consensus::current_epoch();
            assert!(
                self.requests
                    .values()
                    .any(|r| r.status == 0 && r.target_epoch == epoch),
                "No breeding needs this epoch"
            );
            self.epochs
                .entry(epoch)
                .or_insert_with(|| Consensus::current_epoch_hash().to_string());
        }
        pub fn finish_breeding(&mut self, id: String) {
            let target = self
                .requests
                .get(&id)
                .expect("Unknown breeding")
                .target_epoch;
            if !self.epochs.contains_key(&target) && Consensus::current_epoch() == target {
                self.capture_epoch();
            }
            let r = self.requests.get_mut(&id).unwrap();
            assert_eq!(r.status, 0, "Breeding already resolved");
            let epoch_hash = self
                .epochs
                .get(&target)
                .expect("Future epoch has not been captured");
            let hash = Sha256::digest(format!("arkimals:offspring:v1|{id}|{epoch_hash}"));
            let genes: String = (0..8)
                .map(|i| {
                    if hash[i] & 1 == 0 {
                        r.first.genes.as_bytes()[i] as char
                    } else {
                        r.second.genes.as_bytes()[i] as char
                    }
                })
                .collect();
            let generation = r.first.generation.max(r.second.generation) + 1;
            let color = (b'A' + hash[8] % 4) as char;
            let letter = b"GHIKLMNO"[generation as usize] as char;
            let genotype = format!("CANI-{genes}-{letter}{color}");
            r.status = 1;
            let data = metadata!["name" => "Arkimals Canine".to_string(), "genes" => genes, "generation" => generation.to_string(), "color" => color.to_string(), "genotype" => genotype, "art_version" => "waves-canines-v1".to_string(), "breeding_id" => id.clone(), "parent_one" => key(&r.first), "parent_two" => key(&r.second), "draw_epoch" => target.to_string(), "draw_hash" => epoch_hash.clone()];
            let child = ResourceManager::get(self.resource).mint_non_fungible(
                NonFungibleId::from_string(id.clone()),
                &data,
                &(),
            );
            ComponentManager::get(r.recipient).invoke("deposit", args![child]);
            for p in [&r.first, &r.second] {
                ComponentManager::get(r.recipient).invoke(
                    "deposit",
                    args![self.vaults[&p.resource].withdraw_non_fungible(p.token.clone())],
                );
            }
            ComponentManager::get(self.treasury)
                .invoke("deposit", args![self.escrow.withdraw(self.fee)]);
            self.minted += 1;
            emit_event("CanineBred", metadata!["id" => id]);
        }
        pub fn refund_missed_epoch(&mut self, id: String) {
            let r = self.requests.get_mut(&id).expect("Unknown breeding");
            assert_eq!(
                r.owner,
                CallerContext::transaction_signer_public_key(),
                "Owner only"
            );
            assert_eq!(r.status, 0, "Breeding already resolved");
            assert!(
                Consensus::current_epoch() > r.target_epoch
                    && !self.epochs.contains_key(&r.target_epoch),
                "Scheduled draw remains available"
            );
            r.status = 2;
            for p in [&r.first, &r.second] {
                self.parents.remove(&key(p));
                ComponentManager::get(r.recipient).invoke(
                    "deposit",
                    args![self.vaults[&p.resource].withdraw_non_fungible(p.token.clone())],
                );
            }
            ComponentManager::get(r.recipient)
                .invoke("deposit", args![self.escrow.withdraw(self.fee)]);
        }
        pub fn get_resource(&self) -> ResourceAddress {
            self.resource
        }
        pub fn get_requests(&self) -> BTreeMap<String, Breeding> {
            self.requests.clone()
        }
        pub fn get_parents(&self) -> BTreeMap<String, String> {
            self.parents.clone()
        }
        pub fn get_minted(&self) -> u32 {
            self.minted
        }
    }
}
