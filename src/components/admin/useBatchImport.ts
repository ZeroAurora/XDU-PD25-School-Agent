import { message } from "antd";
import { useCallback, useState } from "react";
import { useBatchIngest } from "@/hooks/useApi";

export interface BatchFileInfo {
  name: string;
  size: number;
  documentCount: number;
  preview?: string;
}

export interface ImportConfig {
  skipDuplicates: boolean;
  validateFormat: boolean;
  dryRun: boolean;
}

export interface ImportState {
  status: "idle" | "importing" | "success" | "error";
  progress: number;
  total: number;
  imported: number;
  skipped: number;
  error: string | null;
}

const INITIAL_CONFIG: ImportConfig = {
  skipDuplicates: true,
  validateFormat: true,
  dryRun: false,
};

const INITIAL_STATE: ImportState = {
  status: "idle",
  progress: 0,
  total: 0,
  imported: 0,
  skipped: 0,
  error: null,
};

export function useBatchImport() {
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<BatchFileInfo | null>(null);
  const [config, setConfig] = useState<ImportConfig>(INITIAL_CONFIG);
  const [state, setState] = useState<ImportState>(INITIAL_STATE);

  const batchIngestMutation = useBatchIngest();

  const canImport =
    file !== null &&
    state.status !== "importing" &&
    !batchIngestMutation.isPending;
  const isImporting =
    state.status === "importing" || batchIngestMutation.isPending;

  const updateConfig = useCallback((newConfig: Partial<ImportConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setFileInfo(null);
    setConfig(INITIAL_CONFIG);
    setState(INITIAL_STATE);
  }, []);

  const startImport = useCallback(async () => {
    if (!file || !fileInfo) {
      message.warning("请先选择 JSON 文件");
      return;
    }

    if (config.dryRun) {
      setState({
        status: "success",
        progress: fileInfo.documentCount,
        total: fileInfo.documentCount,
        imported: fileInfo.documentCount,
        skipped: 0,
        error: null,
      });
      message.success(`预览完成，共 ${fileInfo.documentCount} 篇文档`);
      return;
    }

    setState({
      status: "importing",
      progress: 0,
      total: fileInfo.documentCount,
      imported: 0,
      skipped: 0,
      error: null,
    });

    try {
      const content = await file.text();
      const documents = JSON.parse(content);

      if (!Array.isArray(documents)) {
        throw new Error("JSON文件必须包含文档数组");
      }

      const result = await batchIngestMutation.mutateAsync({
        documents,
        options: { skip_duplicates: config.skipDuplicates },
      });

      setState({
        status: "success",
        progress: fileInfo.documentCount,
        total: fileInfo.documentCount,
        imported: result.imported || 0,
        skipped: result.skipped || 0,
        error: null,
      });

      message.success(
        `成功导入 ${result.imported} 篇文档，跳过 ${result.skipped} 篇`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "导入失败";
      setState((prev) => ({
        ...prev,
        status: "error",
        error: errorMessage,
      }));
      message.error(`批量导入失败: ${errorMessage}`);
    }
  }, [file, fileInfo, config, batchIngestMutation]);

  const retry = useCallback(async () => {
    setState(INITIAL_STATE);
    await startImport();
  }, [startImport]);

  return {
    file,
    fileInfo,
    config,
    importState: state,
    setFile,
    setFileInfo,
    updateConfig,
    startImport,
    reset,
    retry,
    canImport,
    isImporting,
  };
}
