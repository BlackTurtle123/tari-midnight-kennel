use tari_template_lib::{prelude::*, types::constants::TARI_TOKEN};
use tari_template_test_tooling::{TemplateTest, transaction::args};

fn balance(t: &TemplateTest, account: ComponentAddress) -> Amount {
    let state = t.read_only_state_store();
    let a = state.get_account(account).unwrap();
    a.vaults().get(&TARI_TOKEN).map(|v| state.get_vault(&v.vault_id()).unwrap().balance()).unwrap_or(Amount::zero())
}

#[test]
fn payment_and_reservation_are_atomic_replay_safe_and_preserve_the_existing_game() {
    let mut t = TemplateTest::new(".", [".", "../contract"]);
    let (player, proof, key) = t.create_funded_account();
    let (treasury, _, _) = t.create_empty_account();
    let game: ComponentAddress = t.call_function("MidnightKennel", "new", args![1u32], vec![t.owner_proof()]);
    let gateway: ComponentAddress = t.call_function("IncubationTreasury", "new", args![game, treasury], vec![]);
    let id = "ab".repeat(16);
    let initial = balance(&t, player);
    // Invalid fee and invalid door must not move any funds or consume a slot.
    for (amount, door) in [(19_000_000u64, 0u8), (21_000_000, 0), (20_000_000, 3)] {
        t.execute_expect_failure(t.transaction()
            .call_method(player, "withdraw", args![TARI_TOKEN, amount])
            .put_last_instruction_output_on_workspace("fee")
            .call_method(gateway, "begin_incubation", args![id.clone(), player, door, Workspace("fee")])
            .build_and_seal(&key), vec![proof.clone()]);
        assert_eq!(balance(&t, player), initial);
        assert_eq!(balance(&t, treasury), Amount::zero());
        let paid: Option<ComponentAddress> = t.call_method(gateway, "get_payment", args![id.clone()], vec![]);
        assert_eq!(paid, None);
    }
    t.execute_expect_success(t.transaction()
        .call_method(player, "withdraw", args![TARI_TOKEN, 20_000_000u64])
        .put_last_instruction_output_on_workspace("fee")
        .call_method(gateway, "begin_incubation", args![id.clone(), player, 0u8, Workspace("fee")])
        .build_and_seal(&key), vec![proof.clone()]);
    assert_eq!(balance(&t, treasury), Amount::from(20_000_000u64));
    let paid: Option<ComponentAddress> = t.call_method(gateway, "get_payment", args![id.clone()], vec![]);
    assert_eq!(paid, Some(player));
    let after = balance(&t, player);
    // Duplicate id and full original game both roll back the attempted payment.
    for attempt in [id.clone(), "cd".repeat(16)] {
        t.execute_expect_failure(t.transaction()
            .call_method(player, "withdraw", args![TARI_TOKEN, 20_000_000u64])
            .put_last_instruction_output_on_workspace("fee")
            .call_method(gateway, "begin_incubation", args![attempt, player, 0u8, Workspace("fee")])
            .build_and_seal(&key), vec![proof.clone()]);
        assert_eq!(balance(&t, player), after);
        assert_eq!(balance(&t, treasury), Amount::from(20_000_000u64));
    }
    // Cross-component reservation retains the player's signer, so the player
    // can hatch through the original contract with no second treasury payment.
    let salt = "01".repeat(32);
    use sha2::{Digest, Sha256};
    let commitment = format!("{:x}", Sha256::digest(format!("midnight-kennel:v2|{id}|0|{salt}").as_bytes()));
    t.call_method::<()>(game, "seal_incubation", args![id.clone(), commitment], vec![t.owner_proof()]);
    t.execute_expect_success(t.transaction().call_method(game, "hatch", args![id, 0u8, salt]).build_and_seal(&key), vec![proof]);
    assert_eq!(balance(&t, treasury), Amount::from(20_000_000u64));
}
