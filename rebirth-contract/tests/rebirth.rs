use sha2::{Digest, Sha256};
use tari_template_lib::{prelude::*, types::constants::TARI_TOKEN};
use tari_template_test_tooling::{
    TemplateTest,
    engine_types::virtual_substate::{VirtualSubstate, VirtualSubstateId},
    transaction::args,
};
const SALT: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
fn epoch(t: &mut TemplateTest, value: u64) {
    t.set_virtual_substate(
        VirtualSubstateId::CurrentEpoch,
        VirtualSubstate::CurrentEpoch(value),
    );
    t.set_virtual_substate(
        VirtualSubstateId::CurrentEpochHash,
        VirtualSubstate::CurrentEpochHash([value as u8; 32].into()),
    );
}
#[test]
fn staking_and_paid_rebirth_are_atomic_authorized_and_funded() {
    let mut t = TemplateTest::new(".", [".", "../contract", "../staking-contract"]);
    let (account, proof, key) = t.create_funded_account();
    let (treasury, _, _) = t.create_empty_account();
    let game: ComponentAddress =
        t.call_function("MidnightKennel", "new", args![10u32], vec![t.owner_proof()]);
    let resource: ResourceAddress = t.call_method(game, "get_resource", args![], vec![]);
    let staking: ComponentAddress = t.call_function(
        "ArkimalsStaking",
        "new",
        args![resource, resource, treasury],
        vec![],
    );
    let rebirth: ComponentAddress = t.call_function(
        "ArkimalsRebirth",
        "new",
        args![resource, resource, staking, treasury, 8_000_000u64],
        vec![],
    );
    let ids: Vec<String> = (0..4).map(|n| format!("{n:032x}")).collect();
    for id in &ids {
        t.execute_expect_success(
            t.transaction()
                .call_method(game, "begin_incubation", args![id.clone(), account, 0u8])
                .build_and_seal(&key),
            vec![],
        );
        let sealed = format!(
            "{:x}",
            Sha256::digest(format!("midnight-kennel:v2|{id}|0|{SALT}"))
        );
        t.call_method::<()>(
            game,
            "seal_incubation",
            args![id.clone(), sealed],
            vec![t.owner_proof()],
        );
        t.execute_expect_success(
            t.transaction()
                .call_method(game, "hatch", args![id.clone(), 0u8, SALT.to_string()])
                .build_and_seal(&key),
            vec![],
        );
    }
    let stake_id = format!("{resource}|str_{}", ids[0]);
    t.execute_expect_success(
        t.transaction()
            .call_method(
                account,
                "withdraw_non_fungible",
                args![resource, NonFungibleId::from_string(ids[0].clone())],
            )
            .put_last_instruction_output_on_workspace("nft")
            .call_method(staking, "stake", args![Workspace("nft"), account])
            .build_and_seal(&key),
        vec![proof.clone()],
    );
    epoch(&mut t, 10);
    for (i, fee, ok) in [
        (1, 7_000_000u64, false),
        (1, 8_000_000, true),
        (2, 8_000_000, true),
    ] {
        let tx = t
            .transaction()
            .call_method(
                account,
                "withdraw_non_fungible",
                args![resource, NonFungibleId::from_string(ids[i].clone())],
            )
            .put_last_instruction_output_on_workspace("nft")
            .call_method(account, "withdraw", args![TARI_TOKEN, fee])
            .put_last_instruction_output_on_workspace("fee")
            .call_method(
                rebirth,
                "begin_rebirth",
                args![Workspace("nft"), Workspace("fee"), account],
            )
            .build_and_seal(&key);
        if ok {
            t.execute_expect_success(tx, vec![proof.clone()]);
        } else {
            t.execute_expect_failure(tx, vec![proof.clone()]);
        }
    }
    let request = |i: usize| {
        format!(
            "{:x}",
            Sha256::digest(format!("arkimals:rebirth:v1|{resource}|str_{}", ids[i]))
        )
    };
    t.execute_expect_failure(
        t.transaction()
            .call_method(rebirth, "finish_rebirth", args![request(1)])
            .build_and_seal(&key),
        vec![],
    );
    t.execute_expect_failure(
        t.transaction()
            .call_method(rebirth, "refund_missed_epoch", args![request(1)])
            .build_and_seal(&key),
        vec![],
    );
    epoch(&mut t, 12);
    t.call_method::<()>(rebirth, "capture_epoch", args![], vec![]);
    t.call_method::<()>(rebirth, "finish_rebirth", args![request(1)], vec![]);
    t.execute_expect_failure(
        t.transaction()
            .call_method(rebirth, "finish_rebirth", args![request(1)])
            .build_and_seal(&key),
        vec![],
    );
    epoch(&mut t, 13);
    t.execute_expect_failure(
        t.transaction()
            .call_method(rebirth, "refund_missed_epoch", args![request(2)])
            .build_and_seal(&key),
        vec![],
    );
    // Second NFT joins after the first fee; it must not earn any of that past fee.
    t.execute_expect_success(
        t.transaction()
            .call_method(
                account,
                "withdraw_non_fungible",
                args![resource, NonFungibleId::from_string(ids[3].clone())],
            )
            .put_last_instruction_output_on_workspace("nft")
            .call_method(staking, "stake", args![Workspace("nft"), account])
            .build_and_seal(&key),
        vec![proof.clone()],
    );
    t.call_method::<()>(rebirth, "finish_rebirth", args![request(2)], vec![]);
    let totals: (u32, u128, u64, u64, u64) = t.call_method(staking, "get_totals", args![], vec![]);
    assert_eq!(totals, (2, 9_000_000_000_000_000_000, 12_000_000, 0, 0));
    t.execute_expect_failure(
        t.transaction()
            .call_method(staking, "unstake", args![stake_id.clone()])
            .build_and_seal(t.secret_key()),
        vec![t.owner_proof()],
    );
    t.execute_expect_success(
        t.transaction()
            .call_method(staking, "claim", args![stake_id.clone()])
            .build_and_seal(&key),
        vec![proof.clone()],
    );
    let totals: (u32, u128, u64, u64, u64) = t.call_method(staking, "get_totals", args![], vec![]);
    assert_eq!(totals.3, 9_000_000);
    // Fractional microtari survive repeated claims; neither staker can overdraw the pool.
    for _ in 0..2 {
        t.execute_expect_success(
            t.transaction()
                .call_method(account, "withdraw", args![TARI_TOKEN, 1u64])
                .put_last_instruction_output_on_workspace("fee")
                .call_method(staking, "deposit_fees", args![Workspace("fee")])
                .call_method(staking, "claim", args![stake_id.clone()])
                .build_and_seal(&key),
            vec![proof.clone()],
        );
    }
    let totals: (u32, u128, u64, u64, u64) = t.call_method(staking, "get_totals", args![], vec![]);
    assert_eq!(totals.3, 9_000_001);
    t.execute_expect_success(
        t.transaction()
            .call_method(staking, "unstake", args![stake_id.clone()])
            .build_and_seal(&key),
        vec![proof.clone()],
    );
    t.execute_expect_failure(
        t.transaction()
            .call_method(staking, "unstake", args![stake_id])
            .build_and_seal(&key),
        vec![proof.clone()],
    );
    // A missed draw refunds its locked principal and ritual fee, never a later reroll.
    epoch(&mut t, 13);
    t.execute_expect_success(
        t.transaction()
            .call_method(
                account,
                "withdraw_non_fungible",
                args![resource, NonFungibleId::from_string(ids[0].clone())],
            )
            .put_last_instruction_output_on_workspace("nft")
            .call_method(account, "withdraw", args![TARI_TOKEN, 8_000_000u64])
            .put_last_instruction_output_on_workspace("fee")
            .call_method(
                rebirth,
                "begin_rebirth",
                args![Workspace("nft"), Workspace("fee"), account],
            )
            .build_and_seal(&key),
        vec![proof.clone()],
    );
    epoch(&mut t, 16);
    t.execute_expect_failure(
        t.transaction()
            .call_method(rebirth, "refund_missed_epoch", args![request(0)])
            .build_and_seal(t.secret_key()),
        vec![t.owner_proof()],
    );
    t.execute_expect_failure(
        t.transaction()
            .call_method(rebirth, "capture_epoch", args![])
            .build_and_seal(t.secret_key()),
        vec![],
    );
    t.execute_expect_success(
        t.transaction()
            .call_method(rebirth, "refund_missed_epoch", args![request(0)])
            .build_and_seal(&key),
        vec![],
    );
    t.execute_expect_failure(
        t.transaction()
            .call_method(rebirth, "refund_missed_epoch", args![request(0)])
            .build_and_seal(&key),
        vec![],
    );
    let a = t.read_only_state_store().get_account(account).unwrap();
    assert!(
        t.read_only_state_store()
            .get_vault(&a.vaults().get(&resource).unwrap().vault_id())
            .unwrap()
            .get_non_fungible_ids()
            .contains(&NonFungibleId::from_string(ids[0].clone()))
    );
    let treasury_account = t.read_only_state_store().get_account(treasury).unwrap();
    let vault = t
        .read_only_state_store()
        .get_vault(
            &treasury_account
                .vaults()
                .get(&TARI_TOKEN)
                .unwrap()
                .vault_id(),
        )
        .unwrap();
    assert_eq!(vault.balance(), Amount::from(4_000_000u64));
}
#[test]
fn browser_amount_and_nft_arguments_match_rust_cbor() {
    let hex = |v: Vec<u8>| v.iter().map(|b| format!("{b:02x}")).collect::<String>();
    assert_eq!(
        hex(minicbor::to_vec(Amount::from(8_000_000u64)).unwrap()),
        "1a007a1200"
    );
    let id = "0123456789abcdef0123456789abcdef";
    assert_eq!(
        hex(minicbor::to_vec(NonFungibleId::from_string(id)).unwrap()),
        format!("8201817820{}", hex(id.as_bytes().to_vec()))
    );
}

#[test]
fn empty_pool_fees_go_to_treasury_without_creating_unfunded_rewards() {
    let mut t = TemplateTest::new(".", [".", "../staking-contract"]);
    let (account, proof, key) = t.create_funded_account();
    let (treasury, _, _) = t.create_empty_account();
    // The resource allowlist is immutable; no NFT is needed for this empty-pool case.
    let resource = TARI_TOKEN;
    let staking: ComponentAddress = t.call_function(
        "ArkimalsStaking",
        "new",
        args![resource, resource, treasury],
        vec![],
    );
    t.execute_expect_success(
        t.transaction()
            .call_method(account, "withdraw", args![TARI_TOKEN, 123u64])
            .put_last_instruction_output_on_workspace("fee")
            .call_method(staking, "deposit_fees", args![Workspace("fee")])
            .build_and_seal(&key),
        vec![proof],
    );
    let totals: (u32, u128, u64, u64, u64) = t.call_method(staking, "get_totals", args![], vec![]);
    assert_eq!(totals, (0, 0, 0, 0, 123));
}
