#!/bin/bash

set -euo pipefail
#set -x

# set DOCKER_ROOT_PWD to parent directory of this script
export DOCKER_ROOT_PWD=$(dirname $(dirname $(realpath "$0")))

export APPLICATION_UID=$(id -u)

export COMPOSE_PROJECT_NAME=testing-storybook
export TYPO3_VERSION=${TYPO3_VERSION:-13.4.15}
# The pluswerk image is published for amd64 only. On arm64 hosts (Apple Silicon) the multi-arch base image it is
# built from is used instead, picked by `uname -m`. Force one of them with `--amd64` or `--arm64` anywhere in the
# arguments, e.g. `bash test.sh --amd64 playwright` runs the CI image through Rosetta.
# TYPO3_IMAGE / TYPO3_PLATFORM in the environment still win over both.
ARCH=$(uname -m)
ARGS=()
for arg in "$@"; do
  case $arg in
    --arm64) ARCH=arm64 ;;
    --amd64) ARCH=x86_64 ;;
    *) ARGS+=("$arg") ;;
  esac
done
set -- ${ARGS[@]+"${ARGS[@]}"}
export PHP_IMAGE_VERSION=${PHP_IMAGE_VERSION:-8.4}
if [[ "$ARCH" == "arm64" || "$ARCH" == "aarch64" ]]; then
  export TYPO3_IMAGE=${TYPO3_IMAGE:-webdevops/php-apache-dev:${PHP_IMAGE_VERSION}-alpine}
  export TYPO3_PLATFORM=${TYPO3_PLATFORM:-linux/arm64}
else
  export TYPO3_IMAGE=${TYPO3_IMAGE:-ghcr.io/pluswerk/php-dev:apache-${PHP_IMAGE_VERSION}-alpine}
  export TYPO3_PLATFORM=${TYPO3_PLATFORM:-linux/amd64}
fi
# not implemented yet:
export STORYBOOK_VERSION=${STORYBOOK_VERSION:-10.6.5}

if [ -S /tmp/.X11-unix/X0 ]; then
  export X11_SOCKET=/tmp/.X11-unix
fi

function requireComposer {
  # if vendor is not present run testFunction composerInstall
  if [ ! -d "$DOCKER_ROOT_PWD/Documentation/dummy-project/vendor" ]; then
    echo "Vendor directory not found, running composer install..."
    testFunction composerInstall
  fi
}
function requireTheNpmPackage {
  # if dist is not present run testFunction buildTheNpmPackage
  if [ ! -d "$DOCKER_ROOT_PWD/the-npm-package/dist" ]; then
    echo "the-npm-package/dist not found building it..."
    testFunction buildTheNpmPackage
  fi
}
function requireStorybookBuild {
  # if node_modules is not present run testFunction storybookBuild
  if [ ! -d "$DOCKER_ROOT_PWD/Documentation/dummy-project/node_modules" ]; then
    echo "Node modules directory not found, running storybook build..."
    testFunction storybookBuild
  fi
}
function requireAll {
  requireComposer
  requireTheNpmPackage
  requireStorybookBuild
}

function testFunction {
  key="$1"
  case ${key} in
     executeAll)
       testFunction composerInstall
       testFunction buildTheNpmPackage
       testFunction storybookBuild
       testFunction playwright
       return
       ;;
     composerInstall)
       rm -rf dummy-project/vendor/
       COMPOSE_PROJECT_NAME=testing-storybook docker compose -f test.docker-compose.yml run --rm --remove-orphans typo3 su application -c "rm -f composer.lock && composer req typo3/cms-core:~${TYPO3_VERSION}"
       chmod 777 $DOCKER_ROOT_PWD/Documentation/dummy-project/public/
       return
       ;;
     buildTheNpmPackage)
       requireComposer
       COMPOSE_PROJECT_NAME=testing-storybook docker compose -f test.docker-compose.yml run --rm --remove-orphans --no-deps playwright su ubuntu -c 'cd ../../the-npm-package && npm ci && npm run build && npm run test'
       testFunction copyToDev
       return
       ;;
     storybookBuild)
       requireComposer
       requireTheNpmPackage
       COMPOSE_PROJECT_NAME=testing-storybook docker compose -f test.docker-compose.yml run --rm --remove-orphans --no-deps playwright su ubuntu -c 'npm ci && npm run build-storybook'
       return
       ;;
     playwright)
       requireAll
       COMPOSE_PROJECT_NAME=testing-storybook docker compose -f test.docker-compose.yml run --rm --remove-orphans playwright su ubuntu -c "npx playwright test ${@:2}"
       return
       ;;
     playwright:u)
       requireAll
       COMPOSE_PROJECT_NAME=testing-storybook docker compose -f test.docker-compose.yml run --rm --remove-orphans playwright su ubuntu -c "npx playwright test -u ${@:2}"
       return
       ;;
     playwright:ui)
       requireAll
       COMPOSE_PROJECT_NAME=testing-storybook docker compose -f test.docker-compose.yml run --rm --remove-orphans playwright su ubuntu -c "npx playwright test --ui ${@:2}"
       return
       ;;
     playwright:open)
       requireAll
       COMPOSE_PROJECT_NAME=testing-storybook docker compose -f test.docker-compose.yml run --rm --remove-orphans playwright su ubuntu -c 'npm run storybook & sleep 1 ; npx playwright open http://localhost:8080/'
       return
       ;;
     playwright:codegen)
       requireAll
       COMPOSE_PROJECT_NAME=testing-storybook docker compose -f test.docker-compose.yml run --rm --remove-orphans playwright su ubuntu -c 'npm run storybook & sleep 1 ; npx playwright codegen http://localhost:8080/'
       return
       ;;
     watchMode)
       bash -c "COMPOSE_PROJECT_NAME=testing-storybook docker compose -f test.docker-compose.yml run -T --rm --remove-orphans --no-deps playwright su ubuntu -c 'cd ../../the-npm-package && npm ci && ./node_modules/.bin/tsc --watch'" &
       TSC_PID=$!
       trap "kill $TSC_PID" SIGHUP SIGINT SIGQUIT SIGABRT
       watch 'bash test.sh copyToDev'
       return
       ;;
     npmLock)
       # regenerate both package-lock.json files with the npm of the CI image.
       # The dummy project links the-npm-package from vendor/ and its lockfile records the dependencies of that
       # linked package: without the vendor copy npm writes an empty link and `npm ci` fails later.
       requireComposer
       testFunction copyToDev
       COMPOSE_PROJECT_NAME=testing-storybook docker compose -f test.docker-compose.yml run --rm --remove-orphans --no-deps playwright su ubuntu -c 'cd ../../the-npm-package && rm -f package-lock.json && npm install --package-lock-only --ignore-scripts && cd ../Documentation/dummy-project && rm -f package-lock.json && npm install --package-lock-only --ignore-scripts'
       return
       ;;
     copyToDev)
       # --chmod: the copy is written by the host user but later modified by the container user `ubuntu` (uid 1000).
       # On Linux CI (runner uid 1001) they differ: `npm ci` in the dummy project runs the prepare script of the linked
       # package and tsc overwrites dist/ in the copy, which fails with "permission denied" on 644 files.
       rsync -av --delete --chmod=ugo+rwX --exclude-from=exclude-watchMode.txt ../ ../Documentation/dummy-project/vendor/andersundsehr/storybook/
       return
       ;;
     reset)
       DP_PATH="$DOCKER_ROOT_PWD/Documentation/dummy-project"
       rm -rf $DP_PATH/node_modules/ $DP_PATH/vendor/ $DP_PATH/var/ $DP_PATH/public/ $DP_PATH/storybook-static/ $DP_PATH/test-results/ $DP_PATH/playwright-report/ $DP_PATH/composer.lock $DP_PATH/.env
       return
       ;;
     docs)
       # we need to remove all symlinks from the Documentation folder as the documentation-renderer does not support them
       rm -rf $DOCKER_ROOT_PWD/Documentation/dummy-project/node_modules
       rm -rf $DOCKER_ROOT_PWD/Documentation/dummy-project/public
       rm -rf $DOCKER_ROOT_PWD/Documentation/dummy-project/vendor
       docker run --rm -it --pull always \
         -v "$DOCKER_ROOT_PWD/Documentation:/project/Documentation" \
         -v "$DOCKER_ROOT_PWD/Documentation-GENERATED-temp:/project/Documentation-GENERATED-temp" \
         -p 5173:5173 ghcr.io/garvinhicking/typo3-documentation-browsersync:latest
       return
       ;;
     *)
       COMPOSE_PROJECT_NAME=testing-storybook docker compose -f test.docker-compose.yml "${@:1}"
       return
       ;;
  esac
}

testFunction "${@:1}"
