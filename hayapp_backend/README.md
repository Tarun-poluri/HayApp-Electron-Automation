# README #

### What is this repository for? ###

The Hayapp backend is an application running on the all in one (AIO) computer which is part of the haystack system. Some if it's most important functions are:
* Data sync between cyphermed cloud and a local database
* Handling User Authentication
* Interface with UI
* Interface with Haystack and its camera
* Interface with iTrace library for suture needle recognition
* Interface with Hayscan
* Event Recorder (logs, images)


### How do I get set up? ###

1. Make sure you have Python 3.11 installed and that it can be run from the command line with the command `python3.11`
2. You need to have ssh access to the hayapp_parlay bitbucket repository
3. Go to the hayapp_python folder to run some make commands
4. Run `make install` to create a virtual environment, install dependencies, create user folders
5. Provision the haystack with its API key, group ID, and Hayscan Auth Key:
  `$AUTH_KEY = @"`
    `YOUR_HAYSCAN_AUTH_KEY`
    `@"`
    `$AUTH_KEY | python3.11 scripts/provision_haystack.py --api-key YOUR_API_KEY --group-id YOUR_GROUP_ID --hayScan-auth-key -`
6. Setup itrace libraries:
    - Build and install opencv 4.7.0 + contrib (see confluence for instructions)
    - `make install-image_decoder` (from itrace: checks itrace marks and image quality)
    - `make install-needle-detector` (from itrace: identifies needles in images)
    - `make build-itrace` (our wrapper for calling the itrace libraries)
    - `make install-vir`  (service that save images from the camera)
7. Run `make run` to start the application

Other options:
1. Run `make venv` to create the virtual environment
2. Run `make upgrade-requirements` to update the requirements files
3. Run `make clean` to remove the virtual environment and start clean.
4. Run `make test` to run the tests


### Contribution guidelines ###

* TODO


### Who do I talk to? ###

* Repo owner or admin: Joost
* Other community or team contact: check commit/ticket contributions for details