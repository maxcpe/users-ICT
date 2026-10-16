"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { checkIdcardAction, setIdcardAction } from "@/app/(app)/u/lifecycle-actions";
import { HMAC_MODES, type HmacMode } from "@/lib/idcard-modes";

/**
 * เลขบัตรประชาชน (spec 6.1): ตรวจคีย์กับค่าที่มีอยู่ และตั้ง/ล้างค่า
 * เลขที่พิมพ์ถูกล้างออกจากช่องทันทีหลังส่ง ไม่แสดงเลขหรือ HMAC บนหน้าจอ
 */
export function IdcardPanel({
  userId,
  hasIdcard,
  confirmedMode,
  readOnly,
}: {
  userId: number;
  hasIdcard: boolean;
  confirmedMode: HmacMode | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [checkValue, setCheckValue] = useState("");
  const [setValue, setSetValue] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      setResult(null);
      await fn();
    });

  return (
    <div className="glass grid gap-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <b>เลขบัตรประชาชน</b>
          <div className="small">เก็บเป็นรหัส HMAC ดูเลขเดิมไม่ได้</div>
        </div>
        {hasIdcard ? <span className="chip chip-ok">✓ มีข้อมูลแล้ว</span> : <span className="chip chip-off">ยังไม่มี</span>}
      </div>

      <div aria-live="polite">
        {error && (
          <div className="callout callout-bad" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}
        {result && (
          <div className="callout callout-info" role="status">
            <span aria-hidden="true">ℹ️</span>
            <span>{result}</span>
          </div>
        )}
      </div>

      {hasIdcard && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = checkValue;
            setCheckValue("");
            run(async () => {
              const r = await checkIdcardAction(userId, v);
              if (!r.ok) return setError(r.error);
              setResult(
                r.modes.length
                  ? `ตรงกับค่าในฐาน · แบบที่ใช้: ${r.modes.map((m) => HMAC_MODES[m]).join(", ")} (${r.modes.join(", ")})`
                  : "ไม่ตรงกับค่าในฐานเลย ตรวจว่าเลขบัตรถูกคน และคีย์ใน .env ตรงกับระบบลงทะเบียน",
              );
            });
          }}
        >
          <label htmlFor="id-check" className="label">ตรวจคีย์ กรอกเลขบัตรของคนนี้ ระบบเทียบกับค่าที่มีอยู่ ไม่บันทึกอะไร</label>
          <div className="flex flex-wrap gap-2">
            <input
              id="id-check"
              className="input mono !w-64"
              inputMode="numeric"
              autoComplete="off"
              maxLength={17}
              value={checkValue}
              onChange={(e) => setCheckValue(e.target.value)}
              placeholder="x-xxxx-xxxxx-xx-x"
            />
            <button type="submit" className="btn" disabled={busy || checkValue.trim() === ""}>ตรวจคีย์</button>
          </div>
        </form>
      )}

      {!readOnly && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = setValue;
            setSetValue("");
            run(async () => {
              const r = await setIdcardAction(userId, v);
              if (!r.ok) return setError(r.error);
              setResult("บันทึกแล้ว");
              router.refresh();
            });
          }}
        >
          <label htmlFor="id-set" className="label">ตั้งเลขบัตรใหม่</label>
          <div className="flex flex-wrap gap-2">
            <input
              id="id-set"
              className="input mono !w-64"
              inputMode="numeric"
              autoComplete="off"
              maxLength={17}
              value={setValue}
              onChange={(e) => setSetValue(e.target.value)}
              placeholder="x-xxxx-xxxxx-xx-x"
              disabled={!confirmedMode}
              aria-describedby="id-set-hint"
            />
            <button type="submit" className="btn btn-primary" disabled={busy || !confirmedMode || setValue.trim() === ""}>บันทึก</button>
            {hasIdcard && (
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await setIdcardAction(userId, "");
                    if (!r.ok) return setError(r.error);
                    setResult("ล้างค่าแล้ว");
                    router.refresh();
                  })
                }
              >
                ล้างค่า
              </button>
            )}
          </div>
          <span id="id-set-hint" className="hint">
            {confirmedMode
              ? `ใช้วิธี: ${HMAC_MODES[confirmedMode]} · ช่องจะว่างทันทีหลังกดบันทึก`
              : "ยังตั้งเลขใหม่ไม่ได้ ต้องกด \"ตรวจคีย์\" กับคนที่มีค่าอยู่แล้วให้ได้ผลตรงก่อน แล้วแจ้งผู้พัฒนาให้ยืนยันวิธีคำนวณ"}
          </span>
        </form>
      )}
    </div>
  );
}
