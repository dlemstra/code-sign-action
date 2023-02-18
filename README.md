# Code sign a file

This action signs `.nupkg` files and files that are supported by `signtool.exe` with a code signing certificate. This action only works on Windows build agents, and that means it will only run on `windows-2019`, `windows-2022` or `windows-latest`.

## Inputs

### `certificate`

**Required** The base64 encoded certificate that does not require a password.

This can done one by converting your pfx file to a base64 encoded string with the following command

```
certutil -encode .\ssCertInfo.pfx .\ssCertInfo.base64.txt
```

Once you run the command, you will need to ensure that only the base64 data is saved in your secret as seen here (truncated)

```
-----BEGIN CERTIFICATE-----
5VYbl04ksEja358dNhGyHscDAiPI07mM9TwzLgvMv+72lHbgOZC57QgTTVOSVIzM
fqku3P2y4EP4rXa3efxRtV9U0Iedxn0gYz7qHszBUCVnb/nUMtnHNd9HWtzgizpr
qmi7jMBMup/eOpXKibt7OzGB2zATBgkqhkiG9w0BCRUxBgQEAQAAADBdBgkrBgEE
AYI3EQExUB5OAE0AaQBjAHIAbwBzAG8AZgB0ACAAUwB0AHIAbwBuAGcAIABDAHIA
DQEMAQMwDgQIg6csl1GYzT4CAgfQgIIO6AdED63pjLYWhE4khARlh33Mwe2GT7np
f5ZayfFO6DeLuc9Zczf41sJR94xSLKzDpvQHpWHiNabP8srad2TEzg8XQrSOgN+Q
vaCuBEErpQ9BjQICB9A=
-----END CERTIFICATE-----
```

You must remove the BEGIN CERTIFICATE and END CERTIFICATE lines before saving your secret.

You may find the secrets page by navigating to `Settings > Secrets > Actions` on your current repo.

### `password`

**Optional** The password to use when opening the PFX file.

### `folder`

**Required** The folder that contains the files to sign.

### `recursive`

**Optional** Recursively search for supported files.

## Example usage

```
runs-on: windows-latest
steps:
  uses: dlemstra/code-sign-action@v1
  with:
    certificate: '${{ secrets.CERTIFICATE }}'
    password: '${{ secrets.CERTIFICATE_PASSWORD }}'
    folder: 'files'
    recursive: true
```