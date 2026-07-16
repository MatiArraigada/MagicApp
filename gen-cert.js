const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const CERT_DIR = path.join(__dirname, '.cert');
if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR);

const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();

cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const attrs = [{ name: 'commonName', value: 'mantetech-local' }];
cert.setSubject(attrs);
cert.setIssuer(attrs);

cert.setExtensions([{
  name: 'subjectAltName',
  altNames: [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' }
  ]
}]);

cert.sign(keys.privateKey, forge.md.sha256.create());

const certPem = forge.pki.certificateToPem(cert);
const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

fs.writeFileSync(path.join(CERT_DIR, 'cert.pem'), certPem);
fs.writeFileSync(path.join(CERT_DIR, 'key.pem'), keyPem);

console.log('Certificado generado OK');
