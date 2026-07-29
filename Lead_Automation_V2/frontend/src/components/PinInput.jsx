'use client';
import { useContext } from 'react';
import { OTPInputContext } from 'input-otp';
import { InputOTP, InputOTPGroup } from '@/components/ui/input-otp';

// One box: shows a filled dot instead of the digit itself, since a PIN
// (unlike the 6-digit email/mobile OTP the shared InputOTPSlot is normally
// used for) is a recurring secret, not a one-time code — masking it matters
// here. Reads the OTPInputContext directly rather than the shared
// InputOTPSlot, which always renders the raw character.
function MaskedSlot({ index, invalid }) {
  const inputOTPContext = useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <div
      data-active={isActive}
      className={`relative flex h-12 w-11 items-center justify-center rounded-xl border text-slate-900 shadow-xs
        transition-all duration-150 border-slate-200 bg-white
        data-[active=true]:border-violet-500 data-[active=true]:ring data-[active=true]:ring-violet-500/15
        ${invalid ? 'border-red-300' : ''}`}
    >
      {char != null && <span className="h-2.5 w-2.5 rounded-full bg-slate-800" />}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  );
}

// Numeric PIN entry — auto-advancing boxes with masked digits, built on the
// same `input-otp` primitive as InputOTP elsewhere in the design system
// (src/components/ui/input-otp.tsx), but with its own masked slot instead
// of the shared InputOTPSlot (which shows the raw character — fine for a
// one-time verification code, not for a recurring PIN).
//
// length: 4 or 6
// value / onChange: controlled string of digits
// autoFocus: focuses the first box on mount
// disabled: true while a request is in flight or the account is locked out
export default function PinInput({ length = 6, value, onChange, autoFocus = false, disabled = false, invalid = false }) {
  return (
    <InputOTP
      maxLength={length}
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
      disabled={disabled}
      inputMode="numeric"
      pattern="^[0-9]*$"
    >
      <InputOTPGroup className="gap-2 w-full justify-center">
        {Array.from({ length }).map((_, i) => (
          <MaskedSlot key={i} index={i} invalid={invalid} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
