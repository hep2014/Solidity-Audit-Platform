import { useRef, useState } from "react";
import { FileArchive, FileCode2, UploadCloud, X } from "lucide-react";
import clsx from "clsx";
import { formatBytes } from "../utils/format";
import { Button } from "./Button";

interface FileDropzoneProps {
  value: File | null;
  accept?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
  onChange: (file: File | null) => void;
}

export function FileDropzone({
  value,
  accept = ".sol,.zip",
  title = "Загрузите Solidity-проект",
  description = "Поддерживаются .sol и .zip архивы с проектом",
  disabled = false,
  onChange
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  function openFilePicker() {
    if (!disabled) {
      inputRef.current?.click();
    }
  }

  function handleFile(file: File | undefined) {
    if (!file || disabled) {
      return;
    }

    onChange(file);
  }

  return (
    <div
      className={clsx("dropzone", {
        "dropzone-active": dragActive,
        "dropzone-disabled": disabled
      })}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        handleFile(event.dataTransfer.files[0]);
      }}
      onClick={openFilePicker}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        hidden
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      {!value ? (
        <>
          <div className="dropzone-icon">
            <UploadCloud size={28} />
          </div>
          <strong>{title}</strong>
          <p>{description}</p>
          <span className="dropzone-hint">Перетащите файл сюда или нажмите для выбора</span>
        </>
      ) : (
        <div className="selected-file">
          <div className="selected-file-icon">
            {value.name.endsWith(".zip") ? <FileArchive size={24} /> : <FileCode2 size={24} />}
          </div>

          <div className="selected-file-body">
            <strong>{value.name}</strong>
            <span>{formatBytes(value.size)}</span>
          </div>

          <Button
            type="button"
            variant="ghost"
            icon={<X size={16} />}
            onClick={(event) => {
              event.stopPropagation();
              onChange(null);
            }}
          >
            Убрать
          </Button>
        </div>
      )}
    </div>
  );
}