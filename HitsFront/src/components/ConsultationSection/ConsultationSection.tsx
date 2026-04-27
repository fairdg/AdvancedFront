import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createConsultationComment, updateConsultationComment } from "../../api/consultation";
import {
  canReplyToConsultation,
  EMPTY_DOCTOR_IDENTITY,
  isSameDoctor,
  type DoctorIdentity,
} from "../../shared/doctorAccess";
import { formatDateTime } from "../../shared/dateTime";
import { asText } from "../../shared/text";
import { isRecord } from "../../shared/typeGuards";
import ui from "../../controls.module.css";
import s from "./ConsultationSection.module.css";

type ConsultationCommentNode = {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createTime: string;
  updatedTime: string;
  parentId: string;
  replies: ConsultationCommentNode[];
};

type ConsultationCardView = {
  id: string;
  specialityId: string;
  specialityName: string;
  rootComment: ConsultationCommentNode | null;
  replies: ConsultationCommentNode[];
  repliesCount: number;
};

type ConsultationSectionProps = {
  consultations: unknown[];
  inspectionDoctorId?: string;
  inspectionDoctorName?: string;
  currentDoctor?: DoctorIdentity;
  onChanged?: () => Promise<void> | void;
};

function normalizeComment(input: unknown): ConsultationCommentNode | null {
  if (!isRecord(input)) return null;

  return {
    id: asText(input.id).trim() || asText(input.commentId).trim(),
    content: asText(input.content || input.text || input.message).trim(),
    authorId: asText(input.authorId || input.doctorId || input.userId).trim(),
    authorName: asText(input.author || input.doctor || input.authorName || input.doctorName || input.userName).trim(),
    createTime: asText(input.createTime || input.createdAt).trim(),
    updatedTime: asText(input.modifiedDate || input.updateTime || input.updatedAt || input.modifyTime || input.editedAt).trim(),
    parentId: asText(input.parentId).trim(),
    replies: [],
  };
}

function countReplies(comments: ConsultationCommentNode[]): number {
  return comments.reduce((sum, comment) => sum + 1 + countReplies(comment.replies), 0);
}

function normalizeConsultation(input: unknown, index: number): ConsultationCardView | null {
  if (!isRecord(input)) return null;

  const comments = [
    ...(Array.isArray(input.comments) ? input.comments : []),
    ...(Array.isArray(input.replies) ? input.replies : []),
    ...(Array.isArray(input.answers) ? input.answers : []),
  ]
    .map(normalizeComment)
    .filter((item): item is ConsultationCommentNode => Boolean(item));

  const byId = new Map(comments.map((comment) => [comment.id, { ...comment, replies: [] as ConsultationCommentNode[] }]));
  const roots: ConsultationCommentNode[] = [];

  for (const comment of byId.values()) {
    if (comment.parentId && byId.has(comment.parentId)) {
      byId.get(comment.parentId)?.replies.push(comment);
    } else {
      roots.push(comment);
    }
  }

  roots.sort((a, b) => a.createTime.localeCompare(b.createTime));

  const summaryComment = roots[0] ?? null;
  const replies = summaryComment ? [...summaryComment.replies, ...roots.slice(1)] : [];

  return {
    id: asText(input.id).trim() || `${asText(input.specialityId)}-${index}`,
    specialityId: asText(input.specialityId || input.specialtyId || (isRecord(input.speciality) ? input.speciality.id : "")).trim(),
    specialityName: asText(input.specialityName || input.specialtyName || input.speciality || (isRecord(input.speciality) ? input.speciality.name : "")).trim(),
    rootComment: summaryComment,
    replies,
    repliesCount: countReplies(replies),
  };
}

function wasEdited(comment: ConsultationCommentNode) {
  return Boolean(comment.updatedTime && comment.updatedTime !== comment.createTime);
}

function CommentNode({
  comment,
  level,
  allowChildRender,
  canReply,
  canEditComment,
  activeEditId,
  editValue,
  onStartEdit,
  onCancelEdit,
  onChangeEditValue,
  onSubmitEdit,
  activeReplyId,
  replyValue,
  onStartReply,
  onCancelReply,
  onChangeReplyValue,
  onSubmitReply,
  isSubmitting,
}: {
  comment: ConsultationCommentNode;
  level: number;
  allowChildRender: boolean;
  canReply: boolean;
  canEditComment: (comment: ConsultationCommentNode) => boolean;
  activeEditId: string | null;
  editValue: string;
  onStartEdit: (comment: ConsultationCommentNode) => void;
  onCancelEdit: () => void;
  onChangeEditValue: (value: string) => void;
  onSubmitEdit: (commentId: string) => void;
  activeReplyId: string | null;
  replyValue: string;
  onStartReply: (commentId: string) => void;
  onCancelReply: () => void;
  onChangeReplyValue: (value: string) => void;
  onSubmitReply: (parentCommentId: string) => void;
  isSubmitting: boolean;
}) {
  const isEditing = activeEditId === comment.id;
  const isReplying = activeReplyId === comment.id;
  const canEdit = canEditComment(comment);

  return (
    <div
      className={s.commentNode}
      style={{ ["--reply-level" as never]: Math.min(level, 3) }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={s.commentMeta}>
        <strong>{comment.authorName || "Врач"}</strong>
        {comment.createTime ? <span>{formatDateTime(comment.createTime)}</span> : null}
      </div>

      {isEditing ? (
        <div className={s.inlineForm}>
          <textarea className={s.textarea} value={editValue} onChange={(e) => onChangeEditValue(e.target.value)} />
          <div className={s.inlineActions}>
            <button className={`${ui.button} ${ui.buttonSecondary}`} type="button" onClick={onCancelEdit} disabled={isSubmitting}>
              Отмена
            </button>
            <button className={ui.button} type="button" onClick={() => onSubmitEdit(comment.id)} disabled={isSubmitting || !editValue.trim()}>
              Сохранить
            </button>
          </div>
        </div>
      ) : (
        <p className={s.commentText}>
          {comment.content || "Комментарий отсутствует."}
          {wasEdited(comment) ? (
            <>
              {" "}
              <span className={s.editedMark} title={formatDateTime(comment.updatedTime)}>
                изменен
              </span>
            </>
          ) : null}
        </p>
      )}

      <div className={s.commentActions}>
        {canEdit && !isEditing ? (
          <button className={s.actionLink} type="button" onClick={() => onStartEdit(comment)}>
            Редактировать
          </button>
        ) : null}
        {canReply && !isReplying ? (
          <button className={s.actionLink} type="button" onClick={() => onStartReply(comment.id)}>
            Ответить
          </button>
        ) : null}
      </div>

      {isReplying ? (
        <div className={s.inlineForm}>
          <textarea className={s.textarea} value={replyValue} onChange={(e) => onChangeReplyValue(e.target.value)} />
          <div className={s.inlineActions}>
            <button className={`${ui.button} ${ui.buttonSecondary}`} type="button" onClick={onCancelReply} disabled={isSubmitting}>
              Отмена
            </button>
            <button className={ui.button} type="button" onClick={() => onSubmitReply(comment.id)} disabled={isSubmitting || !replyValue.trim()}>
              Отправить
            </button>
          </div>
        </div>
      ) : null}

      {allowChildRender && comment.replies.length ? (
        <div className={s.replyList}>
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id || `${reply.authorName}-${reply.createTime}`}
              comment={reply}
              level={level + 1}
              allowChildRender
              canReply={canReply}
              canEditComment={canEditComment}
              activeEditId={activeEditId}
              editValue={editValue}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onChangeEditValue={onChangeEditValue}
              onSubmitEdit={onSubmitEdit}
              activeReplyId={activeReplyId}
              replyValue={replyValue}
              onStartReply={onStartReply}
              onCancelReply={onCancelReply}
              onChangeReplyValue={onChangeReplyValue}
              onSubmitReply={onSubmitReply}
              isSubmitting={isSubmitting}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ConsultationCard({
  consultation,
  currentDoctor,
  inspectionDoctorId,
  inspectionDoctorName,
  onChanged,
}: {
  consultation: ConsultationCardView;
  currentDoctor: DoctorIdentity;
  inspectionDoctorId: string;
  inspectionDoctorName: string;
  onChanged?: () => Promise<void> | void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyValue, setReplyValue] = useState("");

  const canReply = canReplyToConsultation(
    currentDoctor,
    consultation.specialityId,
    consultation.specialityName,
    inspectionDoctorId,
    inspectionDoctorName
  );
  const canEditRoot = consultation.rootComment
    ? isSameDoctor(currentDoctor, consultation.rootComment.authorId, consultation.rootComment.authorName)
    : false;

  const replyMutation = useMutation({
    mutationFn: (payload: { content: string; parentId?: string }) => createConsultationComment(consultation.id, payload),
    onSuccess: async () => {
      setActiveReplyId(null);
      setReplyValue("");
      if (onChanged) await onChanged();
    },
  });

  const editMutation = useMutation({
    mutationFn: (payload: { commentId: string; content: string }) => updateConsultationComment(payload.commentId, { content: payload.content }),
    onSuccess: async () => {
      setActiveEditId(null);
      setEditValue("");
      if (onChanged) await onChanged();
    },
  });

  return (
    <div
      className={`${s.card}${consultation.repliesCount ? ` ${s.cardInteractive}` : ""}`}
      onClick={() => {
        if (consultation.repliesCount) setIsOpen((v) => !v);
      }}
    >
      <div className={s.cardHeader}>
        <div>
          <p className={s.specialityTitle}>{consultation.specialityName || consultation.specialityId || "Требуемый специалист"}</p>
          <p className={s.countText}>Ответов: {consultation.repliesCount}</p>
        </div>
        {consultation.repliesCount ? <button className={s.expandButton} type="button">{isOpen ? "Скрыть" : "Показать"}</button> : null}
      </div>

      {consultation.rootComment ? (
        <CommentNode
          comment={consultation.rootComment}
          level={0}
          allowChildRender={false}
          canReply={canReply}
          canEditComment={() => canEditRoot}
          activeEditId={activeEditId}
          editValue={editValue}
          onStartEdit={(comment) => {
            setActiveReplyId(null);
            setActiveEditId(comment.id);
            setEditValue(comment.content);
          }}
          onCancelEdit={() => {
            setActiveEditId(null);
            setEditValue("");
          }}
          onChangeEditValue={setEditValue}
          onSubmitEdit={(commentId) => editMutation.mutate({ commentId, content: editValue.trim() })}
          activeReplyId={activeReplyId}
          replyValue={replyValue}
          onStartReply={(commentId) => {
            setActiveEditId(null);
            setEditValue("");
            setActiveReplyId(commentId);
          }}
          onCancelReply={() => {
            setActiveReplyId(null);
            setReplyValue("");
          }}
          onChangeReplyValue={setReplyValue}
          onSubmitReply={(parentCommentId) => replyMutation.mutate({ content: replyValue.trim(), parentId: parentCommentId })}
          isSubmitting={replyMutation.isPending || editMutation.isPending}
        />
      ) : (
        <p className={s.commentText}>Комментарий автора осмотра отсутствует.</p>
      )}

      {replyMutation.isError ? <div className={ui.error}>{(replyMutation.error as Error).message}</div> : null}
      {editMutation.isError ? <div className={ui.error}>{(editMutation.error as Error).message}</div> : null}

      {isOpen && consultation.replies.length ? (
        <div className={s.replyList}>
          {consultation.replies.map((reply) => (
            <CommentNode
              key={reply.id || `${reply.authorName}-${reply.createTime}`}
              comment={reply}
              level={1}
              allowChildRender
              canReply={canReply}
              canEditComment={(comment) => isSameDoctor(currentDoctor, comment.authorId, comment.authorName)}
              activeEditId={activeEditId}
              editValue={editValue}
              onStartEdit={(comment) => {
                setActiveReplyId(null);
                setActiveEditId(comment.id);
                setEditValue(comment.content);
              }}
              onCancelEdit={() => {
                setActiveEditId(null);
                setEditValue("");
              }}
              onChangeEditValue={setEditValue}
              onSubmitEdit={(commentId) => editMutation.mutate({ commentId, content: editValue.trim() })}
              activeReplyId={activeReplyId}
              replyValue={replyValue}
              onStartReply={(commentId) => {
                setActiveEditId(null);
                setEditValue("");
                setActiveReplyId(commentId);
              }}
              onCancelReply={() => {
                setActiveReplyId(null);
                setReplyValue("");
              }}
              onChangeReplyValue={setReplyValue}
              onSubmitReply={(parentCommentId) => replyMutation.mutate({ content: replyValue.trim(), parentId: parentCommentId })}
              isSubmitting={replyMutation.isPending || editMutation.isPending}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ConsultationSection({
  consultations,
  inspectionDoctorId = "",
  inspectionDoctorName = "",
  currentDoctor,
  onChanged,
}: ConsultationSectionProps) {
  const doctorIdentity = currentDoctor ?? EMPTY_DOCTOR_IDENTITY;
  const items = useMemo(
    () =>
      consultations
        .map((consultation, index) => normalizeConsultation(consultation, index))
        .filter((item): item is ConsultationCardView => Boolean(item)),
    [consultations]
  );

  if (!items.length) {
    return <p className={s.empty}>Консультации отсутствуют.</p>;
  }

  return (
    <div className={s.list}>
      {items.map((consultation) => (
        <ConsultationCard
          key={consultation.id}
          consultation={consultation}
          currentDoctor={doctorIdentity}
          inspectionDoctorId={inspectionDoctorId}
          inspectionDoctorName={inspectionDoctorName}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}
