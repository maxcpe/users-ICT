"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { LevelEditor } from "@/components/level-editor";
import type { Level } from "@/lib/systems";
import { saveLevels, type FormState } from "../../actions";

export function LevelsForm({ systemKey, levels, inUse }: { systemKey: string; levels: Level[]; inUse: Record<number, number> }) {
  const [state, action] = useActionState<FormState, FormData>(saveLevels.bind(null, systemKey), undefined);
  return (
    <form action={action}>
      <FormMessage state={state} />
      <LevelEditor initial={levels} inUse={inUse} />
      <div className="mt-3.5 flex justify-end">
        <SubmitButton>บันทึกระดับ</SubmitButton>
      </div>
    </form>
  );
}
