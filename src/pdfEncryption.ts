import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFObject,
  PDFRawStream,
  PDFStream,
  PDFString,
  PDFWriter,
} from 'pdf-lib';

// Standard 32-byte padding string defined in ISO 32000-1 Section 7.6.3.3
const PADDING = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
  0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

export function checkPasswordException(error: unknown): {
  isPasswordException: boolean;
  isIncorrectPassword: boolean;
} {
  if (!error || typeof error !== 'object') {
    return { isPasswordException: false, isIncorrectPassword: false };
  }
  const err = error as { name?: string; code?: number; message?: string };
  if (err.name === 'PasswordException') {
    return {
      isPasswordException: true,
      isIncorrectPassword: err.code === 2,
    };
  }
  const msg = String(err.message ?? '');
  if (/password/i.test(msg)) {
    return {
      isPasswordException: true,
      isIncorrectPassword: /incorrect/i.test(msg),
    };
  }
  return { isPasswordException: false, isIncorrectPassword: false };
}

function md5(input: Uint8Array): Uint8Array {
  const K = new Uint32Array([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
    0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
    0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
    0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
    0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ]);

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  const origLen = input.length;
  const bitLenLo = (origLen * 8) >>> 0;
  const bitLenHi = Math.floor((origLen * 8) / 0x100000000) >>> 0;
  const padLen = ((56 - ((origLen + 1) % 64)) + 64) % 64;
  const totalLen = origLen + 1 + padLen + 8;
  const buf = new Uint8Array(totalLen);
  buf.set(input, 0);
  buf[origLen] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(totalLen - 8, bitLenLo, true);
  view.setUint32(totalLen - 4, bitLenHi, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Uint32Array(16);
  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let j = 0; j < 16; j += 1) {
      M[j] = view.getUint32(offset + j * 4, true);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i += 1) {
      let F = 0;
      let g = 0;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }

      const temp = (A + F + K[i] + M[g]) >>> 0;
      const s = S[i];
      const rotated = ((temp << s) | (temp >>> (32 - s))) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotated) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return out;
}

function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) {
    s[i] = i;
  }
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + s[i] + key[i % key.length]) & 0xff;
    const tmp = s[i];
    s[i] = s[j];
    s[j] = tmp;
  }
  const out = new Uint8Array(data.length);
  let i = 0;
  j = 0;
  for (let k = 0; k < data.length; k += 1) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    const tmp = s[i];
    s[i] = s[j];
    s[j] = tmp;
    out[k] = data[k] ^ s[(s[i] + s[j]) & 0xff];
  }
  return out;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const arr of arrays) {
    total += arr.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function passwordToBytes(password: string): Uint8Array {
  const bytes = new Uint8Array(password.length);
  for (let i = 0; i < password.length; i += 1) {
    bytes[i] = password.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function padPassword(password: string): Uint8Array {
  const raw = passwordToBytes(password);
  const out = new Uint8Array(32);
  const len = Math.min(raw.length, 32);
  out.set(raw.subarray(0, len), 0);
  if (len < 32) {
    out.set(PADDING.subarray(0, 32 - len), len);
  }
  return out;
}

function computeOwnerValue(userPw: string, ownerPw: string): Uint8Array {
  const paddedOwner = padPassword(ownerPw || userPw);
  let digest = md5(paddedOwner);
  for (let i = 0; i < 50; i += 1) {
    digest = md5(digest.subarray(0, 16));
  }
  let out = padPassword(userPw);
  const key = new Uint8Array(16);
  for (let i = 0; i <= 19; i += 1) {
    for (let j = 0; j < 16; j += 1) {
      key[j] = digest[j] ^ i;
    }
    out = rc4(key, out);
  }
  return out;
}

function computeEncryptionKey(userPw: string, O: Uint8Array, P: number, id0: Uint8Array): Uint8Array {
  const paddedUser = padPassword(userPw);
  const pBytes = new Uint8Array([
    P & 0xff,
    (P >>> 8) & 0xff,
    (P >>> 16) & 0xff,
    (P >>> 24) & 0xff,
  ]);
  let digest = md5(concatBytes(paddedUser, O, pBytes, id0));
  for (let i = 0; i < 50; i += 1) {
    digest = md5(digest.subarray(0, 16));
  }
  return digest.subarray(0, 16);
}

function computeUserValue(encKey: Uint8Array, id0: Uint8Array): Uint8Array {
  let out = md5(concatBytes(PADDING, id0));
  const key = new Uint8Array(16);
  for (let i = 0; i <= 19; i += 1) {
    for (let j = 0; j < 16; j += 1) {
      key[j] = encKey[j] ^ i;
    }
    out = rc4(key, out);
  }
  return concatBytes(out, new Uint8Array(16));
}

function computeObjectKey(encKey: Uint8Array, objNum: number, genNum: number): Uint8Array {
  const extra = new Uint8Array([
    objNum & 0xff,
    (objNum >>> 8) & 0xff,
    (objNum >>> 16) & 0xff,
    genNum & 0xff,
    (genNum >>> 8) & 0xff,
  ]);
  const digest = md5(concatBytes(encKey, extra));
  return digest.subarray(0, Math.min(encKey.length + 5, 16));
}

function encryptPdfObject(obj: PDFObject, objKey: Uint8Array): PDFObject {
  if (obj instanceof PDFString) {
    const raw = obj.asBytes();
    const enc = rc4(objKey, raw);
    return PDFHexString.of(toHex(enc));
  }
  if (obj instanceof PDFHexString) {
    const raw = obj.asBytes();
    const enc = rc4(objKey, raw);
    return PDFHexString.of(toHex(enc));
  }
  if (obj instanceof PDFStream) {
    encryptPdfObject(obj.dict, objKey);
    const enc = rc4(objKey, obj.getContents());
    return PDFRawStream.of(obj.dict, enc);
  }
  if (obj instanceof PDFDict) {
    for (const [key, val] of obj.entries()) {
      const next = encryptPdfObject(val, objKey);
      if (next !== val) {
        obj.set(key, next);
      }
    }
    return obj;
  }
  if (obj instanceof PDFArray) {
    for (let i = 0; i < obj.size(); i += 1) {
      const val = obj.get(i);
      const next = encryptPdfObject(val, objKey);
      if (next !== val) {
        obj.set(i, next);
      }
    }
    return obj;
  }
  return obj;
}

export async function savePdfWithOptionalEncryption(
  doc: PDFDocument,
  options?: { encryptPassword?: string },
): Promise<Uint8Array> {
  if (options?.encryptPassword === undefined) {
    return doc.save();
  }

  await doc.flush();

  const id0 = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(id0);
  } else {
    for (let i = 0; i < 16; i += 1) {
      id0[i] = Math.floor(Math.random() * 256);
    }
  }

  const userPassword = options.encryptPassword;
  const ownerPassword = userPassword || toHex(id0);
  const P = -4; // Allow printing, copying, modifying
  const O = computeOwnerValue(userPassword, ownerPassword);
  const encKey = computeEncryptionKey(userPassword, O, P, id0);
  const U = computeUserValue(encKey, id0);

  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    const objKey = computeObjectKey(encKey, ref.objectNumber, ref.generationNumber);
    const encryptedObj = encryptPdfObject(obj, objKey);
    if (encryptedObj !== obj) {
      doc.context.assign(ref, encryptedObj);
    }
  }

  const encryptDict = doc.context.obj({
    Filter: PDFName.of('Standard'),
    V: PDFNumber.of(2),
    R: PDFNumber.of(3),
    Length: PDFNumber.of(128),
    P: PDFNumber.of(P),
    O: PDFHexString.of(toHex(O)),
    U: PDFHexString.of(toHex(U)),
  });
  const encryptRef = doc.context.register(encryptDict);
  const idHex = PDFHexString.of(toHex(id0));
  doc.context.trailerInfo.Encrypt = encryptRef;
  doc.context.trailerInfo.ID = doc.context.obj([idHex, idHex]);

  return PDFWriter.forContext(doc.context, 50).serializeToBuffer();
}
