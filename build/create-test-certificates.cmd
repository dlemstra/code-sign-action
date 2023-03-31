@echo off

openssl genrsa -des3 -out ca.key -passout pass:casecret 2048
openssl req -x509 -new -nodes -key ca.key -subj "/CN=Root Certificate" -passin pass:casecret -sha256 -out ca.pem
openssl x509 -outform der -in ca.pem -out ca.crt
certutil -addstore Root ca.crt

openssl req -nodes -newkey rsa:2048 -subj "/CN=Code Signing Certificate" -keyout sign.key -out sign.csr
openssl x509 -req -CA ca.pem -CAkey ca.key -passin pass:casecret -in sign.csr -CAcreateserial -extfile v3.ext -out sign.crt

openssl pkcs12 -export -passout pass: -inkey sign.key -in sign.crt -out certificate_without_password.pfx
certutil -encode certificate_without_password.pfx certificate_without_password.txt
echo CERTIFICATE_WITHOUT_PASSWORD^<^<EOF >> %GITHUB_ENV%
type certificate_without_password.txt >> %GITHUB_ENV%
echo EOF >> %GITHUB_ENV%

openssl pkcs12 -export -passout pass:secret -inkey sign.key -in sign.crt -out certificate_with_password.pfx
certutil -encode certificate_with_password.pfx certificate_with_password.txt
echo CERTIFICATE_WITH_PASSWORD^<^<EOF >> %GITHUB_ENV%
type certificate_with_password.txt >> %GITHUB_ENV%
echo EOF >> %GITHUB_ENV%
