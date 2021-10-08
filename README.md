# Code sign a file

This action signs `.nupkg` files and files that are supported by `signtool.exe` with a code signing certificate. This action only works on Windows and that means it should run on `windows-latest`.

## Inputs

### `certificate`

**Required** The base64 encoded certificate.

### `folder`

**Required** The folder that contains the libraries to sign.

### `recursive`

**Optional** Recursively search for supported files.

## Example usage

```
runs-on: windows-latest
steps:
  uses: dlemstra/code-sign-action@v1
  with:
    certificate: '${{ secrets.CERTIFICATE }}'
    folder: 'files'
    recursive: true
```