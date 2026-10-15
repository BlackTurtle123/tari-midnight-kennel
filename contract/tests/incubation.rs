use sha2::{Digest, Sha256};
use tari_template_lib::types::{ComponentAddress, NonFungibleId};
use tari_template_test_tooling::{TemplateTest, support::assert_error::assert_reject_reason, transaction::args};

const ID: &str = "0123456789abcdef0123456789abcdef";
const SALT: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

fn commitment(id: &str, variant: u8) -> String {
    format!("{:x}", Sha256::digest(format!("midnight-kennel:v1|{id}|{variant}|{SALT}").as_bytes()))
}

fn setup(test: &mut TemplateTest, cap: u32) -> ComponentAddress {
    let template = test.get_template_address("MidnightKennel");
    test.execute_expect_success(test.transaction().call_function(template, "new", args![cap]).build_and_seal(test.secret_key()), vec![test.owner_proof()]);
    test.read_only_state_store().get_components_by_template_address(template).unwrap().remove(0).0
}

#[test]
fn hatch_mints_real_nft_into_fixed_recipient_and_rejects_replay() {
    let mut test = TemplateTest::my_crate();
    let game = setup(&mut test, 10);
    let (account, _, secret) = test.create_empty_account();
    test.execute_expect_success(test.transaction().call_method(game, "begin_incubation", args![ID.to_string(), account, 0u8]).build_and_seal(&secret), vec![]);
    test.execute_expect_success(test.transaction().call_method(game, "seal_incubation", args![ID.to_string(), commitment(ID, 2)]).build_and_seal(test.secret_key()), vec![test.owner_proof()]);
    test.execute_expect_success(test.transaction().call_method(game, "hatch", args![ID.to_string(), 2u8, SALT.to_string()]).build_and_seal(&secret), vec![]);
    let state = test.read_only_state_store();
    let acc = state.get_account(account).unwrap();
    let (_, vault) = acc.vaults().first_key_value().unwrap();
    let vault = state.get_vault(&vault.vault_id()).unwrap();
    assert_eq!(vault.get_non_fungible_ids().len(), 1);
    assert!(vault.get_non_fungible_ids().contains(&NonFungibleId::from_string(ID)));
    let reason = test.execute_expect_failure(test.transaction().call_method(game, "hatch", args![ID.to_string(), 2u8, SALT.to_string()]).build_and_seal(&secret), vec![]);
    assert_reject_reason(reason, "Already hatched");
}

#[test]
fn stolen_opening_does_not_authorize_another_player() {
    let mut test = TemplateTest::my_crate();
    let game = setup(&mut test, 10);
    let (alice, _, alice_key) = test.create_empty_account();
    let (_, _, bob_key) = test.create_empty_account();
    test.execute_expect_success(test.transaction().call_method(game, "begin_incubation", args![ID.to_string(), alice, 1u8]).build_and_seal(&alice_key), vec![]);
    test.execute_expect_success(test.transaction().call_method(game, "seal_incubation", args![ID.to_string(), commitment(ID, 4)]).build_and_seal(test.secret_key()), vec![test.owner_proof()]);
    let reason = test.execute_expect_failure(test.transaction().call_method(game, "hatch", args![ID.to_string(), 4u8, SALT.to_string()]).build_and_seal(&bob_key), vec![]);
    assert_reject_reason(reason, "Only the incubator owner can hatch");
    test.execute_expect_success(test.transaction().call_method(game, "hatch", args![ID.to_string(), 4u8, SALT.to_string()]).build_and_seal(&alice_key), vec![]);
}

#[test]
fn altered_reward_fails_without_consuming_the_claim() {
    let mut test = TemplateTest::my_crate();
    let game = setup(&mut test, 10);
    let (alice, _, key) = test.create_empty_account();
    test.execute_expect_success(test.transaction().call_method(game, "begin_incubation", args![ID.to_string(), alice, 2u8]).build_and_seal(&key), vec![]);
    test.execute_expect_success(test.transaction().call_method(game, "seal_incubation", args![ID.to_string(), commitment(ID, 0)]).build_and_seal(test.secret_key()), vec![test.owner_proof()]);
    let reason = test.execute_expect_failure(test.transaction().call_method(game, "hatch", args![ID.to_string(), 5u8, SALT.to_string()]).build_and_seal(&key), vec![]);
    assert_reject_reason(reason, "Opening does not match committed outcome");
    test.execute_expect_success(test.transaction().call_method(game, "hatch", args![ID.to_string(), 0u8, SALT.to_string()]).build_and_seal(&key), vec![]);
}

#[test]
fn operator_cannot_change_a_sealed_outcome() {
    let mut test = TemplateTest::my_crate();
    let game = setup(&mut test, 10);
    let (account, _, key) = test.create_empty_account();
    test.execute_expect_success(test.transaction().call_method(game, "begin_incubation", args![ID.to_string(), account, 0u8]).build_and_seal(&key), vec![]);
    test.execute_expect_success(test.transaction().call_method(game, "seal_incubation", args![ID.to_string(), commitment(ID, 0)]).build_and_seal(test.secret_key()), vec![test.owner_proof()]);
    let reason = test.execute_expect_failure(test.transaction().call_method(game, "seal_incubation", args![ID.to_string(), commitment(ID, 1)]).build_and_seal(test.secret_key()), vec![test.owner_proof()]);
    assert_reject_reason(reason, "Outcome already committed");
}

#[test]
fn only_operator_can_seal_and_no_hatching_before_seal() {
    let mut test = TemplateTest::my_crate();
    let game = setup(&mut test, 10);
    let (account, _, key) = test.create_empty_account();
    test.execute_expect_success(test.transaction().call_method(game, "begin_incubation", args![ID.to_string(), account, 0u8]).build_and_seal(&key), vec![]);
    test.execute_expect_failure(test.transaction().call_method(game, "seal_incubation", args![ID.to_string(), commitment(ID, 0)]).build_and_seal(&key), vec![]);
    let reason = test.execute_expect_failure(test.transaction().call_method(game, "hatch", args![ID.to_string(), 0u8, SALT.to_string()]).build_and_seal(&key), vec![]);
    assert_reject_reason(reason, "Outcome not ready");
}

#[test]
fn duplicate_request_and_supply_overbooking_fail() {
    let mut test = TemplateTest::my_crate();
    let game = setup(&mut test, 1);
    let (account, _, key) = test.create_empty_account();
    test.execute_expect_success(test.transaction().call_method(game, "begin_incubation", args![ID.to_string(), account, 0u8]).build_and_seal(&key), vec![]);
    let reason = test.execute_expect_failure(test.transaction().call_method(game, "begin_incubation", args![ID.to_string(), account, 0u8]).build_and_seal(&key), vec![]);
    assert_reject_reason(reason, "Incubation already exists");
    let reason = test.execute_expect_failure(test.transaction().call_method(game, "begin_incubation", args!["11111111111111111111111111111111".to_string(), account, 0u8]).build_and_seal(&key), vec![]);
    assert_reject_reason(reason, "Event is full");
}
