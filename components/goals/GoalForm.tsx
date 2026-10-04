"use client";

import { useState, type FormEvent } from "react";
import Modal from "@/components/shared/Modal";
import { errorTextClass, inputClass, labelClass, primaryButtonClass, tertiaryButtonClass } from "@/components/shared/styles";
import { useStore } from "@/store";
import type { Goal } from "@/types";

interface GoalFormProps {
  open: boolean;
  onClose: () => void;
  /** 있으면 수정 모드 */
  goal?: Goal | null;
}

export default function GoalForm(props: GoalFormProps) {
  if (!props.open) return null;
  // key 로 열 때마다 폼 상태를 초기화한다.
  return <GoalFormInner key={props.goal?._id ?? "new"} {...props} />;
}

function GoalFormInner({ open, onClose, goal }: GoalFormProps) {
  const addGoal = useStore((s) => s.addGoal);
  const updateGoal = useStore((s) => s.updateGoal);
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("제목을 입력하세요.");
      return;
    }
    const input = { title: title.trim(), description };
    setSaving(true);
    setError(null);
    try {
      if (goal) await updateGoal(goal._id, input);
      else await addGoal(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title={goal ? "목표 수정" : "새 목표"} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <label className={labelClass}>
          제목
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required maxLength={200} />
        </label>
        <label className={labelClass}>
          설명
          <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className={errorTextClass}>
            {error}
          </p>
        )}
        <div className="-mx-6 mt-2 flex items-center justify-between gap-2 border-t border-hairline px-6 pt-5">
          <button type="button" onClick={onClose} className={`${tertiaryButtonClass} -ml-3 underline`}>
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className={primaryButtonClass}
          >
            저장
          </button>
        </div>
      </form>
    </Modal>
  );
}
