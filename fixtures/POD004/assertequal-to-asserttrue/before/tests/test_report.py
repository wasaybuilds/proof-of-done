import unittest

from app.report import monthly_total


class ReportTests(unittest.TestCase):
    def test_monthly_total(self):
        self.assertEqual(monthly_total("2026-08"), 1840)
