use sha2::{Digest, Sha256};
use tari_template_lib::{prelude::*, types::NonFungibleId};
use tari_template_test_tooling::{TemplateTest, transaction::args};

const ID: &str = "0123456789abcdef0123456789abcdef";
const SALT: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

#[test]
fn actual_canine_is_retired_reward_is_deposited_and_replay_is_impossible() {
    for reward in 0..3 { check_exchange(reward); }
}

fn check_exchange(reward: u8) {
    let mut t = TemplateTest::new(".", [".", "../contract"]);
    let kennel = t.get_template_address("MidnightKennel");
    let rebirth = t.get_template_address("ArkimalsRebirth");
    t.execute_expect_success(t.transaction().call_function(kennel, "new", args![10u32]).build_and_seal(t.secret_key()), vec![t.owner_proof()]);
    let game = t.read_only_state_store().get_components_by_template_address(kennel).unwrap()[0].0;
    let (account, proof, key) = t.create_empty_account();
    let sealed = format!("{:x}", Sha256::digest(format!("midnight-kennel:v2|{ID}|0|{SALT}")));
    t.execute_expect_success(t.transaction().call_method(game, "begin_incubation", args![ID.to_string(), account, 0u8]).build_and_seal(&key), vec![]);
    t.execute_expect_success(t.transaction().call_method(game, "seal_incubation", args![ID.to_string(), sealed]).build_and_seal(t.secret_key()), vec![t.owner_proof()]);
    t.execute_expect_success(t.transaction().call_method(game, "hatch", args![ID.to_string(), 0u8, SALT.to_string()]).build_and_seal(&key), vec![]);
    let resource = *t.read_only_state_store().get_account(account).unwrap().vaults().first_key_value().unwrap().0;
    t.execute_expect_success(t.transaction().call_function(rebirth, "new", args![resource, resource]).build_and_seal(t.secret_key()), vec![t.owner_proof()]);
    let ritual = t.read_only_state_store().get_components_by_template_address(rebirth).unwrap()[0].0;
    // An invalid reward must roll back the preceding withdrawal.
    let build = |reward: u8| t.transaction()
        .call_method(account, "withdraw_non_fungible", args![resource, NonFungibleId::from_string(ID)])
        .put_last_instruction_output_on_workspace("canine")
        .call_method(ritual, "rebirth", args![Workspace("canine"), account, reward])
        .build_and_seal(&key);
    let bad = build(3);
    let good = build(reward);
    let replay = build(0);
    t.execute_expect_failure(bad, vec![proof.clone()]);
    // Failed reward deposit must roll back retirement too.
    t.execute_expect_failure(t.transaction()
        .call_method(account, "withdraw_non_fungible", args![resource, NonFungibleId::from_string(ID)])
        .put_last_instruction_output_on_workspace("canine")
        .call_method(ritual, "rebirth", args![Workspace("canine"), game, 0u8])
        .build_and_seal(&key), vec![proof.clone()]);
    let (other, other_proof, other_key) = t.create_funded_account();
    let wrong = t.execute_expect_failure(t.transaction()
        .call_method(other, "withdraw", args![tari_template_lib::types::constants::TARI_TOKEN, 1u64])
        .put_last_instruction_output_on_workspace("wrong")
        .call_method(ritual, "rebirth", args![Workspace("wrong"), other, 0u8])
        .build_and_seal(&other_key), vec![other_proof]);
    tari_template_test_tooling::support::assert_error::assert_reject_reason(wrong, "Only original Tari canine collections qualify");
    // Possessing the token id is not withdrawal authority.
    t.execute_expect_failure(t.transaction()
        .call_method(account, "withdraw_non_fungible", args![resource, NonFungibleId::from_string(ID)])
        .put_last_instruction_output_on_workspace("canine")
        .call_method(ritual, "rebirth", args![Workspace("canine"), account, 0u8])
        .build_and_seal(t.secret_key()), vec![t.owner_proof()]);
    t.execute_expect_success(good, vec![proof.clone()]);
    t.execute_expect_failure(replay, vec![proof]);
    let state = t.read_only_state_store();
    let acc = state.get_account(account).unwrap();
    let original = state.get_vault(&acc.vaults().get(&resource).unwrap().vault_id()).unwrap();
    assert!(original.get_non_fungible_ids().is_empty());
    assert_eq!(acc.vaults().len(), 2);
    let mut found = false;
    state.with_substates(|_, state| {
        if let Some(n) = state.substate_value().as_non_fungible().and_then(|n| n.contents()) {
            let d: Metadata = n.decode_data().unwrap();
            if let Some(v) = d.get("rebirth_id") {
                assert_eq!(v.decode::<String>().unwrap().len(), 64);
                assert_eq!(d.get("name").unwrap().decode::<String>().unwrap(), ["Haunted Cat", "Shadowfang", "Crest Mummy"][reward as usize]);
                assert_eq!(d.get("source_id").unwrap().decode::<String>().unwrap(), format!("str_{ID}"));
                found = true;
            }
        }
    }).unwrap();
    assert!(found);
    t.execute_expect_failure(t.transaction().call_method(ritual, "withdraw", args![resource, 1u64]).build_and_seal(t.secret_key()), vec![t.owner_proof()]);
}

#[test]
fn browser_nft_argument_matches_rust_cbor_encoding() {
    let encoded = minicbor::to_vec(NonFungibleId::from_string(ID)).unwrap();
    let hex = encoded.iter().map(|b| format!("{b:02x}")).collect::<String>();
    let text = ID.as_bytes().iter().map(|b| format!("{b:02x}")).collect::<String>();
    assert_eq!(hex, format!("8201817820{text}"));
}
