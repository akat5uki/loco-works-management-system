import { useState } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateCode(length = 4): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

export function useCaptcha() {
  const [captchaCode, setCaptchaCode] = useState(() => generateCode());
  const [captcha, setCaptcha] = useState("");

  const refreshCaptcha = () => {
    setCaptchaCode(generateCode());
    setCaptcha("");
  };



  const validate = (): boolean =>
    captcha.trim().toUpperCase() === captchaCode;

  return { captcha, setCaptcha, captchaCode, refreshCaptcha, validate };
}
