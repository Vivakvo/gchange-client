#!/bin/bash

### Control that the script is run on `dev` branch
branch=`git rev-parse --abbrev-ref HEAD`
if [[ ! "$branch" = "master" ]];
then
  echo ">> This script must be run under \`master\` branch"
  exit -1
fi

DIRNAME=`pwd`

### Get current version (package.json)
current=`grep -oP "version\": \"\d+.\d+.\d+((a|b)[0-9]+)?" package.json | grep -oP "\d+.\d+.\d+((a|b)[0-9]+)?"`
if [[ "_$current" == "_" ]]; then
  echo "Unable to get current version. Please check version format is: x.y.z (x and y should be an integer)."
  exit -1;
fi
echo "Current version: $current"

### Get current version for Android
currentAndroid=`grep -oP "android-versionCode=\"[0-9]+\"" config.xml | grep -oP "\d+"`
if [[ "_$currentAndroid" == "_" ]]; then
  echo "Unable to get current Android version. Please check version format is an integer."
  exit -1;
fi
echo "Current Android version: $currentAndroid"

### Releasing
if [[ $2 =~ ^[0-9]+.[0-9]+.[0-9]+((a|b)[0-9]+)?$ && $3 =~ ^[0-9]+$ ]]; then

  echo "new build version: $2"
  echo "new build android version: $3"
  case "$1" in
    rel|pre)
      # Change the version in files: 'package.json' and 'config.xml'
      sed -i "s/version\": \"$current\"/version\": \"$2\"/g" package.json
      currentConfigXmlVersion=`grep -oP "version=\"\d+.\d+.\d+((a|b)[0-9]+)?\"" config.xml | grep -oP "\d+.\d+.\d+((a|b)[0-9]+)?"`
      sed -i "s/ version=\"$currentConfigXmlVersion\"/ version=\"$2\"/g" config.xml
      sed -i "s/ android-versionCode=\"$currentAndroid\"/ android-versionCode=\"$3\"/g" config.xml

      # Change version in file: 'www/manifest.json'
      currentManifestJsonVersion=`grep -oP "version\": \"\d+.\d+.\d+((a|b)[0-9]+)?\"" www/manifest.json | grep -oP "\d+.\d+.\d+((a|b)[0-9]+)?"`
      sed -i "s/version\": \"$currentManifestJsonVersion\"/version\": \"$2\"/g" www/manifest.json

      # Bump the install.sh
      sed -i "s/echo \"v.*\" #lastest/echo \"v$2\" #lastest/g" install.sh
      ;;
    *)
      echo "No task given"
      exit -1
      ;;
  esac

  # Load env.sh if exists
  if [[ -f "${DIRNAME}/env.sh" ]]; then
    source ${DIRNAME}/env.sh $*
  fi

  # Check the Java version
  JAVA_VERSION=`java -version 2>&1 | grep "java version" | awk '{print $3}' | tr -d \"`
  if [[ $? -ne 0 ]]; then
    echo "No Java JRE 1.8 found in machine. This is required for Android artifacts."
    exit -1
  fi
  JAVA_MINOR_VERSION=`echo ${JAVA_VERSION} | awk '{split($0, array, ".")} END{print array[2]}'`
  if [[ ${JAVA_MINOR_VERSION} -ne 8 ]]; then
    echo "Require a Java JRE in version 1.8, but found ${JAVA_VERSION}. You can override your default JAVA_HOME in 'env.sh'."
    exit -1
  fi
  echo "Java: $JAVA_VERSION"


  # force nodejs version to 5
  if [[ -d "$NVM_DIR" ]]; then
    . $NVM_DIR/nvm.sh
    nvm use 5
    if [[ $? -ne 0 ]]; then
      exit -1
    fi
  else
    echo "nvm (Node version manager) not found (directory $NVM_DIR not found). Please install, and retry"
    exit -1
  fi

  # Update config file
  gulp config --env default

  echo "----------------------------------"
  echo "- Compiling sources..."
  echo "----------------------------------"
  gulp

  echo "----------------------------------"
  echo "- Building Android artifact..."
  echo "----------------------------------"
  ionic build android --release
  if [[ $? -ne 0 ]]; then
    exit -1
  fi

  echo "----------------------------------"
  echo "- Building web artifact..."
  echo "----------------------------------"

  # Update config file
  gulp config --env default
  gulp build:web --release
  if [[ $? -ne 0 ]]; then
    exit -1
  fi

  echo "----------------------------------"
  echo "- Executing git push, with tag: v$2"
  echo "----------------------------------"

  # Commit
  cd $DIRNAME
  git reset HEAD
  git add package.json config.xml install.sh www/js/config.js www/manifest.json
  git commit -m "v$2"
  git tag "v$2"
  git push
  if [[ $? -ne 0 ]]; then
    exit -1
  fi

  description="$4"
  if [[ "_$description" == "_" ]]; then
     description="Release v$1"
  fi

  if [[ "_$4" != "_" ]]; then
      echo "**********************************"
      echo "* Uploading artifacts to Github..."
      echo "**********************************"

      ./github.sh $1 ''"$description"''
      if [[ $? -ne 0 ]]; then
        exit -1
      fi

      echo "----------------------------------"
      echo "- Building desktop artifacts..."
      echo "----------------------------------"

      # Remove old vagrant virtual machines
      #rm -rf ~/.vagrant.d/*

      #FIXME: ceci empêche d'etre sur le master/origin de gchange-desktop
      #git submodule update --init
      git submodule sync
      cd platforms/desktop

      # Exclude Windows - TODO FIXME (not enough space in BL directories)
      EXPECTED_ASSETS="gchange-desktop-v$2-linux-x64.deb
gchange-desktop-v$2-linux-x64.tar.gz"
      export EXPECTED_ASSETS

      ./release.sh $2
      if [[ $? -ne 0 ]]; then
          exit -1
      fi

      # back to nodejs version 5
      cd $DIRNAME
      nvm use 5

    echo "**********************************"
    echo "* Build release succeed !"
    echo "**********************************"
  else

    echo "**********************************"
    echo "* Build release succeed !"
    echo "**********************************"

    echo " WARN - missing arguments 'release_description'"
    echo
    echo "   Binaries files NOT sending to github repository"
    echo "   Please run:"
    echo "   > ./github.sh pre|rel 'release_description'"
    echo
    echo "   Desktop artifact are NOT build"
    echo "   Please run:"
    echo "   > platforms/desktop/release.sh <version>"
    echo
  fi

else
  echo "Wrong version format"
  echo "Usage:"
  echo " > ./release.sh [pre|rel] <version> <android-version> <release_description>"
  echo "with:"
  echo "  version: x.y.z"
  echo "  android-version: nnn"
  echo "  release_description: a short description of the release"
fi

