from collections import defaultdict


def calculate_net_balances(splits: list[dict], settlements: list[dict]) -> list[dict]:
    """
    Returns list of {from, to, amount} where `from` owes `to`.
    Nets mutual debts. Excludes self-owed and zero amounts.
    """
    owed: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))

    for s in splits:
        debtor = s["member_id"]
        creditor = s["expenses"]["paid_by_member_id"]
        if debtor == creditor:
            continue
        owed[debtor][creditor] += float(s["share_amount"])

    for s in settlements:
        owed[s["from_member_id"]][s["to_member_id"]] -= float(s["amount"])

    result = []
    seen: set[tuple] = set()
    for a in list(owed):
        for b in list(owed[a]):
            pair = tuple(sorted([a, b]))
            if pair in seen:
                continue
            seen.add(pair)
            net = owed[a][b] - owed[b][a]
            if net > 0.005:
                result.append({"from": a, "to": b, "amount": round(net, 2)})
            elif net < -0.005:
                result.append({"from": b, "to": a, "amount": round(-net, 2)})

    return result
