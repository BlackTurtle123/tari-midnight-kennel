use std::collections::BTreeMap;
use tari_template_lib::{prelude::*, types::constants::TARI_TOKEN};

#[template]
mod incubation_treasury {
    use super::*;

    /// Paid entry into the existing incubator. Its collection and outstanding
    /// secrets stay on the original contract. The operator verifies this receipt
    /// before sealing any new paid incubation.
    pub struct IncubationTreasury {
        game: ComponentAddress,
        treasury: ComponentAddress,
        fee: u64,
        payments: BTreeMap<String, ComponentAddress>,
    }
    impl IncubationTreasury {
        pub fn new(game: ComponentAddress, treasury: ComponentAddress) -> Component<Self> {
            assert!(game != treasury, "Treasury must be a separate account");
            Component::new(Self { game, treasury, fee: 20_000_000, payments: BTreeMap::new() })
                .with_owner_rule(OwnerRule::None)
                .with_access_rules(ComponentAccessRules::new()
                    .method("begin_incubation", rule!(allow_all))
                    .method("get_payment", rule!(allow_all)))
                .create()
        }
        pub fn begin_incubation(&mut self, id: String, recipient: ComponentAddress, door: u8, payment: Bucket) {
            assert!(!self.payments.contains_key(&id), "Incubation fee already paid");
            assert_eq!(payment.resource_address(), TARI_TOKEN, "Pay in public TARI");
            assert_eq!(payment.amount(), Amount::from(self.fee), "Wrong incubation fee");
            // Reservation, receipt and treasury deposit commit together. Any
            // failure rolls back all three, including the caller's withdrawal.
            ComponentManager::get(self.game).invoke("begin_incubation", args![id.clone(), recipient, door]);
            ComponentManager::get(self.treasury).invoke("deposit", args![payment]);
            self.payments.insert(id.clone(), recipient);
            emit_event("IncubationFeePaid", metadata!["id" => id, "recipient" => recipient.to_string(), "fee" => self.fee.to_string()]);
        }
        pub fn get_payment(&self, id: String) -> Option<ComponentAddress> {
            self.payments.get(&id).cloned()
        }
    }
}
