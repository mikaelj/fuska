#!/bin/bash

fuska do planned 'update the @CHANGELOG.md from the available git tags plus an "Unreleased (<git-short-hash-of-HEAD>)" section w/ changes from the latest release to HEAD. This way, if the script is run before a new commit has been made, no changes are required (so check the unreleased section against git-hash-of-HEAD first). If there is nothing to commit for git (staged or otherwise), do a git diff from last released version to HEAD and upate the changelog with version' $1 'for the "Unreleased" version'


