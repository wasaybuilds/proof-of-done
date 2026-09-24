from billing import invoice_total


def test_total_with_tax():
    assert invoice_total([100], tax=0.2) == 120
