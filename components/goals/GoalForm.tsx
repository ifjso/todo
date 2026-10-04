"use client";

import { useState, type FormEvent } from "react";
import Modal from "@/components/shared/Modal";
import { inputClass } from "@/components/shared/styles";
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
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          제목
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required maxLength={200} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          설명
          <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800">
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </form>
    </Modal>
  );
}
