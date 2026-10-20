use std::collections::BTreeMap;
use tari_template_lib::prelude::*;
use tari_template_lib::types::constants::TARI_TOKEN;

const SCALE: u128 = 1_000_000_000_000;
#[derive(Clone, Debug, minicbor::Encode, minicbor::Decode, minicbor::CborLen)]
pub struct Stake {
    #[n(0)]
    pub owner: RistrettoPublicKeyBytes,
    #[n(1)]
    pub recipient: ComponentAddress,
    #[n(2)]
    pub resource: ResourceAddress,
    #[n(3)]
    pub token: NonFungibleId,
    #[n(4)]
    pub index: String,
    #[n(5)]
    pub fraction: String,
}
#[template]
mod arkimals_staking {
    use super::*;
    pub struct ArkimalsStaking {
        vaults: BTreeMap<ResourceAddress, Vault>,
        rewards: Vault,
        treasury: ComponentAddress,
        positions: BTreeMap<String, Stake>,
        index: String,
        distributed: u64,
        claimed: u64,
        empty_pool_fees: u64,
    }
    impl ArkimalsStaking {
        pub fn new(
            current: ResourceAddress,
            legacy: ResourceAddress,
            treasury: ComponentAddress,
        ) -> Component<Self> {
            Self::create_pool(vec![current, legacy], treasury)
        }
        /// Collection provenance must not partition canine farming income.
        pub fn new_unified(
            current: ResourceAddress,
            legacy: ResourceAddress,
            offspring: ResourceAddress,
            treasury: ComponentAddress,
        ) -> Component<Self> {
            Self::create_pool(vec![current, legacy, offspring], treasury)
        }
        fn create_pool(
            resources: Vec<ResourceAddress>,
            treasury: ComponentAddress,
        ) -> Component<Self> {
            let mut vaults = BTreeMap::new();
            for resource in resources {
                if !vaults.contains_key(&resource) {
                    vaults.insert(resource, Vault::new_empty(resource));
                }
            }
            Component::new(Self {
                vaults,
                rewards: Vault::new_empty(TARI_TOKEN),
                treasury,
                positions: BTreeMap::new(),
                index: "0".to_string(),
                distributed: 0,
                claimed: 0,
                empty_pool_fees: 0,
            })
            .with_owner_rule(OwnerRule::None)
            .with_access_rules(
                ComponentAccessRules::new()
                    .method("stake", rule!(allow_all))
                    .method("claim", rule!(allow_all))
                    .method("unstake", rule!(allow_all))
                    .method("deposit_fees", rule!(allow_all))
                    .method("get_positions", rule!(allow_all))
                    .method("get_totals", rule!(allow_all)),
            )
            .create()
        }
        pub fn stake(&mut self, canine: Bucket, recipient: ComponentAddress) {
            assert!(self.positions.len() < 250, "Staking pool is full");
            let resource = canine.resource_address();
            let vault = self
                .vaults
                .get(&resource)
                .expect("Only registered canine collections may stake");
            let ids = canine.get_non_fungible_ids();
            assert_eq!(ids.len(), 1, "Stake exactly one canine");
            let token = ids[0].clone();
            let id = format!("{resource}|{token}");
            assert!(!self.positions.contains_key(&id), "Already staked");
            self.positions.insert(
                id,
                Stake {
                    owner: CallerContext::transaction_signer_public_key(),
                    recipient,
                    resource,
                    token,
                    index: self.index.clone(),
                    fraction: "0".to_string(),
                },
            );
            vault.deposit(canine);
        }
        /// Only deposited fees create rewards. A new stake starts at the current index.
        pub fn deposit_fees(&mut self, fees: Bucket) {
            assert_eq!(fees.resource_address(), TARI_TOKEN, "Only TARI fees");
            let amount = fees
                .amount()
                .to_u64_checked()
                .expect("Fee amount too large");
            assert!(amount > 0, "Empty fee deposit");
            if self.positions.is_empty() {
                self.empty_pool_fees = self.empty_pool_fees.checked_add(amount).unwrap();
                ComponentManager::get(self.treasury).invoke("deposit", args![fees]);
            } else {
                self.index = self
                    .index
                    .parse::<u128>()
                    .unwrap()
                    .checked_add(u128::from(amount) * SCALE / self.positions.len() as u128)
                    .unwrap()
                    .to_string();
                self.distributed = self.distributed.checked_add(amount).unwrap();
                self.rewards.deposit(fees);
            }
        }
        pub fn claim(&mut self, id: String) {
            let p = self.positions.get_mut(&id).expect("Stake not found");
            assert_eq!(
                p.owner,
                CallerContext::transaction_signer_public_key(),
                "Stake owner only"
            );
            let credit = self
                .index
                .parse::<u128>()
                .unwrap()
                .checked_sub(p.index.parse::<u128>().unwrap())
                .unwrap()
                .checked_add(p.fraction.parse::<u128>().unwrap())
                .unwrap();
            let amount: u64 = (credit / SCALE).try_into().unwrap();
            p.fraction = (credit % SCALE).to_string();
            p.index = self.index.clone();
            if amount > 0 {
                self.claimed = self.claimed.checked_add(amount).unwrap();
                ComponentManager::get(p.recipient)
                    .invoke("deposit", args![self.rewards.withdraw(amount)]);
            }
        }
        pub fn unstake(&mut self, id: String) {
            self.claim(id.clone());
            let p = self.positions.remove(&id).unwrap();
            let nft = self
                .vaults
                .get(&p.resource)
                .unwrap()
                .withdraw_non_fungible(p.token);
            ComponentManager::get(p.recipient).invoke("deposit", args![nft]);
        }
        pub fn get_positions(&self) -> BTreeMap<String, Stake> {
            self.positions.clone()
        }
        pub fn get_totals(&self) -> (u32, u128, u64, u64, u64) {
            (
                self.positions.len() as u32,
                self.index.parse::<u128>().unwrap(),
                self.distributed,
                self.claimed,
                self.empty_pool_fees,
            )
        }
    }
}
