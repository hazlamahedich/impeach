import unittest

from eval import __version__


class EvalSmokeTest(unittest.TestCase):
    def test_package_version_present(self) -> None:
        self.assertEqual(__version__, "0.0.1")


if __name__ == "__main__":
    unittest.main()
