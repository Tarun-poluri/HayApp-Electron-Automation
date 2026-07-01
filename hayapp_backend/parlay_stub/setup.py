from setuptools import setup, find_packages

setup(
    name="parlay",
    version="0.0.1",
    packages=find_packages(),
    package_data={"parlay": ["server/config.json"]},
)
