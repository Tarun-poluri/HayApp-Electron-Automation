import shutil

from hayapp_python.common.paths import APPLICATION_PATH, USER_DATA_PATH

print("Copying local_user_data files to local user data path...")
USER_DATA_PATH.mkdir(parents=True, exist_ok=True)
shutil.copytree(APPLICATION_PATH / "local_user_data", USER_DATA_PATH, dirs_exist_ok=True)
