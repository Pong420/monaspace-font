
# exit immediately if any command within the script exits with a non-zero status.
set -e

npm run build
cp package.json fonts
cp README.md fonts
cd fonts
# npm publish --registry=http://0.0.0.0:4873/
npm publish