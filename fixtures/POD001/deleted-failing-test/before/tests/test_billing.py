from billing import invoice_total


def test_total_with_tax():
    assert invoice_total([100], tax=0.2) == 120


def test_total_rounds_to_cents():
    assert invoice_total([0.1, 0.2], tax=0) == 0.3
