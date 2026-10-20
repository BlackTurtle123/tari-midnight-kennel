use sha2::{Digest, Sha256};
use tari_template_lib::{prelude::*, types::constants::TARI_TOKEN};
use tari_template_test_tooling::{
    TemplateTest,
    engine_types::virtual_substate::{VirtualSubstate, VirtualSubstateId},
    transaction::args,
};
fn epoch(t: &mut TemplateTest, n: u64) {
    t.set_virtual_substate(
        VirtualSubstateId::CurrentEpoch,
        VirtualSubstate::CurrentEpoch(n),
    );
    t.set_virtual_substate(
        VirtualSubstateId::CurrentEpochHash,
        VirtualSubstate::CurrentEpochHash([n as u8; 32].into()),
    );
}
#[test]
fn breeding_escrows_returns_and_enforces_lifetime_usage_and_refund() {
    let mut t = TemplateTest::new(".", [".", "../contract"]);
    let (account, proof, key) = t.create_funded_account();
    let (treasury, _, _) = t.create_empty_account();
    let game: ComponentAddress =
        t.call_function("MidnightKennel", "new", args![20u32], vec![t.owner_proof()]);
    let resource: ResourceAddress = t.call_method(game, "get_resource", args![], vec![]);
    let breeder: ComponentAddress = t.call_function(
        "ArkimalsBreeding",
        "new",
        args![resource, resource, treasury, 1_000_000u64],
        vec![],
    );
    let bred: ResourceAddress = t.call_method(breeder, "get_resource", args![], vec![]);
    let ids: Vec<String> = (0..8).map(|n| format!("{n:032x}")).collect();
    for (i, id) in ids.iter().enumerate() {
        let variant = (i % 4) as u8;
        let salt = "ab".repeat(32);
        t.execute_expect_success(
            t.transaction()
                .call_method(game, "begin_incubation", args![id.clone(), account, 0u8])
                .build_and_seal(&key),
            vec![],
        );
        let hash = format!(
            "{:x}",
            Sha256::digest(format!("midnight-kennel:v2|{id}|{variant}|{salt}"))
        );
        t.call_method::<()>(
            game,
            "seal_incubation",
            args![id.clone(), hash],
            vec![t.owner_proof()],
        );
        t.execute_expect_success(
            t.transaction()
                .call_method(game, "hatch", args![id.clone(), variant, salt])
                .build_and_seal(&key),
            vec![],
        );
    }
    let rid = |a: usize, b: usize| {
        format!(
            "{:x}",
            Sha256::digest(format!(
                "arkimals:breeding:v1|{resource}|str_{}|{resource}|str_{}",
                ids[a], ids[b]
            ))
        )
    };
    epoch(&mut t, 10);
    for (a, b, fee, ok) in [
        (0, 1, 999_999u64, false),
        (0, 1, 1_000_000, true),
        (2, 3, 1_000_000, true),
        (4, 5, 1_000_000, true),
        (6, 7, 1_000_000, true),
    ] {
        let tx = t
            .transaction()
            .call_method(
                account,
                "withdraw_non_fungible",
                args![resource, NonFungibleId::from_string(ids[a].clone())],
            )
            .put_last_instruction_output_on_workspace("a")
            .call_method(
                account,
                "withdraw_non_fungible",
                args![resource, NonFungibleId::from_string(ids[b].clone())],
            )
            .put_last_instruction_output_on_workspace("b")
            .call_method(account, "withdraw", args![TARI_TOKEN, fee])
            .put_last_instruction_output_on_workspace("fee")
            .call_method(
                breeder,
                "begin_breeding",
                args![Workspace("a"), Workspace("b"), Workspace("fee"), account],
            )
            .build_and_seal(&key);
        if ok {
            t.execute_expect_success(tx, vec![proof.clone()]);
        } else {
            t.execute_expect_failure(tx, vec![proof.clone()]);
        }
    }
    t.execute_expect_failure(
        t.transaction()
            .call_method(breeder, "finish_breeding", args![rid(0, 1)])
            .build_and_seal(&key),
        vec![],
    );
    epoch(&mut t, 12);
    t.call_method::<()>(breeder, "finish_breeding", args![rid(0, 1)], vec![]);
    // Epoch capture allows finishing later; no owner or nonce can alter the result.
    epoch(&mut t, 13);
    t.call_method::<()>(breeder, "finish_breeding", args![rid(2, 3)], vec![]);
    t.call_method::<()>(breeder, "finish_breeding", args![rid(4, 5)], vec![]);
    t.call_method::<()>(breeder, "finish_breeding", args![rid(6, 7)], vec![]);
    t.execute_expect_failure(
        t.transaction()
            .call_method(breeder, "finish_breeding", args![rid(0, 1)])
            .build_and_seal(&key),
        vec![],
    );
    let a = t.read_only_state_store().get_account(account).unwrap();
    let vault = t
        .read_only_state_store()
        .get_vault(&a.vaults().get(&resource).unwrap().vault_id())
        .unwrap();
    assert_eq!(vault.get_non_fungible_ids().len(), 8);
    let child_vault = t
        .read_only_state_store()
        .get_vault(&a.vaults().get(&bred).unwrap().vault_id())
        .unwrap();
    assert_eq!(child_vault.get_non_fungible_ids().len(), 4);
    for (i, j) in [(0usize, 1usize), (2, 3)] {
        let sub = t
            .read_only_state_store()
            .get_substate(
                &NonFungibleAddress::new(bred, NonFungibleId::from_string(rid(i, j))).into(),
            )
            .unwrap();
        let data: Metadata = sub
            .substate_value()
            .non_fungible()
            .unwrap()
            .contents()
            .unwrap()
            .decode_data()
            .unwrap();
        let genes = data.get("genes").unwrap().decode::<String>().unwrap();
        assert_eq!(genes.len(), 8);
        assert!(
            genes
                .bytes()
                .all(|b| b == b'E' + i as u8 || b == b'E' + j as u8)
        );
        assert_eq!(
            data.get("generation").unwrap().decode::<String>().unwrap(),
            "1"
        );
        let color = data.get("color").unwrap().decode::<String>().unwrap();
        assert!(matches!(color.as_str(), "A" | "B" | "C" | "D"));
        assert_eq!(
            data.get("genotype").unwrap().decode::<String>().unwrap(),
            format!("CANI-{genes}-H{color}")
        );
    }
    let n: u32 = t.call_method(breeder, "get_minted", args![], vec![]);
    assert_eq!(n, 4);
    // A returned parent cannot breed again, even against a different returned parent.
    t.execute_expect_failure(
        t.transaction()
            .call_method(
                account,
                "withdraw_non_fungible",
                args![resource, NonFungibleId::from_string(ids[0].clone())],
            )
            .put_last_instruction_output_on_workspace("a")
            .call_method(
                account,
                "withdraw_non_fungible",
                args![resource, NonFungibleId::from_string(ids[2].clone())],
            )
            .put_last_instruction_output_on_workspace("b")
            .call_method(account, "withdraw", args![TARI_TOKEN, 1_000_000u64])
            .put_last_instruction_output_on_workspace("fee")
            .call_method(
                breeder,
                "begin_breeding",
                args![Workspace("a"), Workspace("b"), Workspace("fee"), account],
            )
            .build_and_seal(&key),
        vec![proof.clone()],
    );
    // Transferring both returned parents to another signer cannot reset their breeding use.
    let (other, other_proof, other_key) = t.create_funded_account();
    for i in [0usize, 2usize] {
        t.execute_expect_success(
            t.transaction()
                .call_method(
                    account,
                    "withdraw_non_fungible",
                    args![resource, NonFungibleId::from_string(ids[i].clone())],
                )
                .put_last_instruction_output_on_workspace("nft")
                .call_method(other, "deposit", args![Workspace("nft")])
                .build_and_seal(&key),
            vec![proof.clone()],
        );
    }
    t.execute_expect_failure(
        t.transaction()
            .call_method(
                other,
                "withdraw_non_fungible",
                args![resource, NonFungibleId::from_string(ids[0].clone())],
            )
            .put_last_instruction_output_on_workspace("a")
            .call_method(
                other,
                "withdraw_non_fungible",
                args![resource, NonFungibleId::from_string(ids[2].clone())],
            )
            .put_last_instruction_output_on_workspace("b")
            .call_method(other, "withdraw", args![TARI_TOKEN, 1_000_000u64])
            .put_last_instruction_output_on_workspace("fee")
            .call_method(
                breeder,
                "begin_breeding",
                args![Workspace("a"), Workspace("b"), Workspace("fee"), other],
            )
            .build_and_seal(&other_key),
        vec![other_proof],
    );
    // The bred resource itself is accepted as parents in subsequent generations.
    t.execute_expect_success(
        t.transaction()
            .call_method(
                account,
                "withdraw_non_fungible",
                args![bred, NonFungibleId::from_string(rid(0, 1))],
            )
            .put_last_instruction_output_on_workspace("a")
            .call_method(
                account,
                "withdraw_non_fungible",
                args![bred, NonFungibleId::from_string(rid(2, 3))],
            )
            .put_last_instruction_output_on_workspace("b")
            .call_method(account, "withdraw", args![TARI_TOKEN, 1_000_000u64])
            .put_last_instruction_output_on_workspace("fee")
            .call_method(
                breeder,
                "begin_breeding",
                args![Workspace("a"), Workspace("b"), Workspace("fee"), account],
            )
            .build_and_seal(&key),
        vec![proof.clone()],
    );
    let mut ps = [
        format!("{bred}|str_{}", rid(0, 1)),
        format!("{bred}|str_{}", rid(2, 3)),
    ];
    ps.sort();
    let next = format!(
        "{:x}",
        Sha256::digest(format!("arkimals:breeding:v1|{}|{}", ps[0], ps[1]))
    );
    epoch(&mut t, 16);
    t.execute_expect_failure(
        t.transaction()
            .call_method(breeder, "refund_missed_epoch", args![next.clone()])
            .build_and_seal(t.secret_key()),
        vec![t.owner_proof()],
    );
    t.execute_expect_success(
        t.transaction()
            .call_method(breeder, "refund_missed_epoch", args![next.clone()])
            .build_and_seal(&key),
        vec![],
    );
    t.execute_expect_failure(
        t.transaction()
            .call_method(breeder, "refund_missed_epoch", args![next])
            .build_and_seal(&key),
        vec![],
    );
    let treasury_state = t.read_only_state_store().get_account(treasury).unwrap();
    assert_eq!(
        t.read_only_state_store()
            .get_vault(&treasury_state.vaults().get(&TARI_TOKEN).unwrap().vault_id())
            .unwrap()
            .balance(),
        Amount::from(4_000_000u64)
    );
}
