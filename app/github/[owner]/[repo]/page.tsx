/* eslint-disable @typescript-eslint/ban-ts-comment */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  GitHubIssue,
  IssueStats,
  PaginationInfo,
  IssuesResponse,
} from "../../../../types";
import { IssueTableView } from "../../../../components/issues/IssueTableView";
import { Card } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import {
  ExternalLink,
  GitPullRequest,
  AlertCircle,
  CheckCircle2,
  Database,
  Loader2,
  Brain,
  X,
  Pause,
  Play,
  GitBranch,
  RotateCcw,
} from "lucide-react";

export default function RepoPage() {
  const params = useParams();
  const owner = params.owner as string;
  const repo = params.repo as string;

  const [issues, setIssues] = useState<
    (GitHubIssue & { github_repos?: { full_name: string; html_url: string } })[]
  >([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [stats, setStats] = useState<IssueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [repoInfo, setRepoInfo] = useState<
    { html_url: string; full_name: string } | null | undefined
  >(null);

  // 搜索和分页参数
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [batchAnalysisStatus, setBatchAnalysisStatus] = useState<{
    processedCount: number;
    totalCount: number;
    current: number;
    total: number;
    currentRepo?: string;
    successCount?: number;
    errorCount?: number;
    status?: string;
  } | null>(null);
  const [batchMessage, setBatchMessage] = useState("");
  
  // 10x并行分析状态
  const [is10xAnalyzing, setIs10xAnalyzing] = useState(false);
  const [batchAnalysis10xStatus, setBatchAnalysis10xStatus] = useState<{
    processedCount: number;
    totalCount: number;
    successCount?: number;
    errorCount?: number;
    status?: string;
  } | null>(null);
  const [batch10xMessage, setBatch10xMessage] = useState("");

  const fetchRepoData = useCallback(async () => {
    setLoading(true);
    try {
      // 构建查询参数
      const params = new URLSearchParams({
        repo: `${owner}/${repo}`,
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });

      if (searchQuery) {
        params.set("search", searchQuery);
      }

      // Fetch issues for this specific repository
      const issuesResponse = await fetch(`/api/issues?${params}`);
      const issuesResult: IssuesResponse = await issuesResponse.json();

      if (issuesResult.data) {
        setIssues(issuesResult.data);
        setPagination(issuesResult.pagination);
      }

      // Try to get repository information from the issues data
      if (issuesResult.data && issuesResult.data.length > 0) {
        setRepoInfo(issuesResult.data[0].github_repos);
      }
    } catch (error) {
      console.error("Error fetching repository data:", error);
    }
    setLoading(false);
  }, [owner, repo, currentPage, pageSize, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      // Fetch repository stats
      const statsResponse = await fetch(
        `/api/issues/stats?repo=${owner}/${repo}`
      );
      const statsData = await statsResponse.json();
      setStats(statsData);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [owner, repo]);

  // 处理搜索
  const handleSearch = useCallback((search: string) => {
    setSearchQuery(search);
    setCurrentPage(1); // 搜索时重置到第一页
  }, []);

  // 处理分页
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // 处理每页数量变化
  const handleLimitChange = useCallback((limit: number) => {
    setPageSize(limit);
    setCurrentPage(1); // 改变每页数量时重置到第一页
  }, []);

  // 处理历史数据解析
  const handleAnalyzeHistoricalData = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysisMessage("开始解析历史数据...");

    try {
      const response = await fetch("/api/analyze-historical-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setAnalysisMessage(
          `解析完成！处理了 ${result.processedCount} 条数据，创建了 ${result.weeksCreated} 个周期记录。`
        );
      } else {
        setAnalysisMessage(`解析失败：${result.error}`);
      }
    } catch (error) {
      console.error("Error analyzing historical data:", error);
      setAnalysisMessage("解析失败：网络错误或服务器错误");
    } finally {
      setIsAnalyzing(false);
      // 5秒后清除消息
      setTimeout(() => setAnalysisMessage(""), 5000);
    }
  }, [owner, repo]);

  // 处理全量AI打标分析
  const handleBatchAnalysis = useCallback(async () => {
    setIsBatchAnalyzing(true);
    setBatchMessage("正在启动全量AI分析...");

    try {
      const response = await fetch("/api/batch-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: "start",
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setBatchMessage(
          `分析已启动！总共 ${result.totalCount} 个issues需要处理`
        );
        // 开始轮询状态
        startStatusPolling();
      } else {
        setBatchMessage(`启动失败：${result.error}`);
        setIsBatchAnalyzing(false);
      }
    } catch (error) {
      console.error("Error starting batch analysis:", error);
      setBatchMessage("启动失败：网络错误或服务器错误");
      setIsBatchAnalyzing(false);
    }
  }, [owner, repo]);

  // 轮询批处理状态
  const startStatusPolling = useCallback(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch("/api/batch-analysis", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            repo: `${owner}/${repo}`,
            action: "status",
          }),
        });

        const status = await response.json();
        setBatchAnalysisStatus(status);

        if (status.status === "running") {
          setBatchMessage(
            `正在处理：${status.processedCount}/${status.totalCount} (成功：${status.successCount}, 错误：${status.errorCount})`
          );
          // 更频繁的轮询以获得更及时的进度更新
          setTimeout(pollStatus, 1000);
        } else if (status.status === "paused") {
          setBatchMessage(
            `分析已暂停：${status.processedCount}/${status.totalCount} (成功：${status.successCount}, 错误：${status.errorCount})`
          );
          setIsBatchAnalyzing(false);
          // 暂停状态不需要继续轮询，但保持消息显示
        } else if (status.status === "completed") {
          setBatchMessage(
            `分析完成！处理了 ${status.processedCount} 个issues，成功 ${status.successCount} 个，错误 ${status.errorCount} 个`
          );
          setIsBatchAnalyzing(false);
          // 5秒后清除消息
          setTimeout(() => setBatchMessage(""), 8000);
        } else if (status.status === "cancelled") {
          setBatchMessage("分析已取消");
          setIsBatchAnalyzing(false);
          setTimeout(() => setBatchMessage(""), 5000);
        }
      } catch (error) {
        console.error("Error polling status:", error);
        setBatchMessage("状态检查失败，但分析可能仍在进行中");
        setIsBatchAnalyzing(false);
      }
    };

    // 立即开始第一次轮询，然后每秒轮询一次
    setTimeout(pollStatus, 500);
  }, [owner, repo]);

  // 取消批处理
  const handleCancelBatchAnalysis = useCallback(async () => {
    try {
      const response = await fetch("/api/batch-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: "cancel",
        }),
      });

      if (response.ok) {
        setBatchMessage("正在取消分析...");
      }
    } catch (error) {
      console.error("Error cancelling batch analysis:", error);
    }
  }, [owner, repo]);

  // 暂停批处理
  const handlePauseBatchAnalysis = useCallback(async () => {
    try {
      const response = await fetch("/api/batch-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: "pause",
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setBatchMessage(
          `分析已暂停！已处理 ${result.processedCount}/${result.totalCount}，剩余 ${result.remainingCount} 个`
        );
        setIsBatchAnalyzing(false);
      } else {
        setBatchMessage(`暂停失败：${result.error}`);
      }
    } catch (error) {
      console.error("Error pausing batch analysis:", error);
      setBatchMessage("暂停失败：网络错误或服务器错误");
    }
  }, [owner, repo]);

  // 继续批处理
  const handleResumeBatchAnalysis = useCallback(async () => {
    try {
      setBatchMessage("正在恢复分析...");

      const response = await fetch("/api/batch-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: "resume",
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setBatchMessage(
          `分析已恢复！将从 ${result.processedCount}/${result.totalCount} 继续，剩余 ${result.remainingCount} 个`
        );
        setIsBatchAnalyzing(true);
        // 开始轮询状态
        startStatusPolling();
      } else {
        setBatchMessage(`恢复失败：${result.error}`);
      }
    } catch (error) {
      console.error("Error resuming batch analysis:", error);
      setBatchMessage("恢复失败：网络错误或服务器错误");
    }
  }, [owner, repo, startStatusPolling]);

  // 重试失败的项目
  const handleRetryFailedItems = useCallback(async () => {
    try {
      setBatchMessage("正在重试失败的项目...");

      const response = await fetch("/api/batch-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: "retry",
        }),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.retriedCount > 0) {
          setBatchMessage(
            `已重试 ${result.retriedCount} 个失败的项目，正在重新处理...`
          );
          setIsBatchAnalyzing(true);
          // 开始轮询状态
          startStatusPolling();
        } else {
          setBatchMessage("没有发现失败的项目需要重试");
          setTimeout(() => setBatchMessage(""), 3000);
        }
      } else {
        setBatchMessage(`重试失败：${result.error}`);
        setTimeout(() => setBatchMessage(""), 5000);
      }
    } catch (error) {
      console.error("Error retrying failed items:", error);
      setBatchMessage("重试失败：网络错误或服务器错误");
      setTimeout(() => setBatchMessage(""), 5000);
    }
  }, [owner, repo, startStatusPolling]);

  // 检查批量分析状态
  const checkBatchAnalysisStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/batch-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: "status",
        }),
      });

      const status = await response.json();

      if (response.ok && status.status !== "not_started") {
        setBatchAnalysisStatus(status);

        if (status.status === "running") {
          console.log("🔄 检测到正在进行的批量分析，恢复状态和轮询");
          setBatchMessage(
            `正在处理：${status.processedCount}/${status.totalCount} (成功：${status.successCount}, 错误：${status.errorCount})`
          );
          setIsBatchAnalyzing(true);
          // 如果是运行状态，开始轮询
          startStatusPolling();
        } else if (status.status === "paused") {
          console.log("🔄 检测到暂停的批量分析，恢复暂停状态");
          setBatchMessage(
            `分析已暂停：${status.processedCount}/${status.totalCount} (成功：${status.successCount}, 错误：${status.errorCount})`
          );
          setIsBatchAnalyzing(false);
        } else if (status.status === "completed") {
          console.log("🔄 检测到已完成的批量分析");
          setBatchMessage(
            `分析完成！处理了 ${status.processedCount} 个issues，成功 ${status.successCount} 个，错误 ${status.errorCount} 个`
          );
          setIsBatchAnalyzing(false);
        }
      }
    } catch (error) {
      console.error("Error checking batch analysis status:", error);
    }
  }, [owner, repo]);

  // 10x并行分析相关函数
  const handle10xBatchAnalysis = useCallback(async () => {
    setIs10xAnalyzing(true);
    setBatch10xMessage("正在启动10x并行AI分析...");

    try {
      const response = await fetch("/api/batch-analysis-10x", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: "start",
        }),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.needAnalysis === 0) {
          // All issues already analyzed
          setBatch10xMessage(
            `所有 ${result.totalCount} 个issues都已分析完成，无需重复处理`
          );
          setIs10xAnalyzing(false);
          setTimeout(() => setBatch10xMessage(""), 5000);
        } else if (result.alreadyAnalyzedCount > 0) {
          setBatch10xMessage(
            `10x分析已启动！需要处理 ${result.totalCount} 个issues，跳过 ${result.alreadyAnalyzedCount} 个已分析，使用10个并发任务`
          );
          // 开始轮询状态
          start10xStatusPolling();
        } else {
          setBatch10xMessage(
            `10x分析已启动！总共 ${result.totalCount} 个issues需要处理，使用10个并发任务`
          );
          // 开始轮询状态
          start10xStatusPolling();
        }
      } else {
        setBatch10xMessage(`启动失败：${result.error}`);
        setIs10xAnalyzing(false);
      }
    } catch (error) {
      console.error("Error starting 10x batch analysis:", error);
      setBatch10xMessage("启动失败：网络错误或服务器错误");
      setIs10xAnalyzing(false);
    }
  }, [owner, repo]);

  // 10x分析状态轮询
  const start10xStatusPolling = useCallback(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch("/api/batch-analysis-10x", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            repo: `${owner}/${repo}`,
            action: "status",
          }),
        });

        const status = await response.json();
        setBatchAnalysis10xStatus(status);

        if (status.status === "running") {
          setBatch10xMessage(
            `10x并行处理中：${status.processedCount}/${status.totalCount} (成功：${status.successCount}, 错误：${status.errorCount})`
          );
          // 继续轮询
          setTimeout(pollStatus, 1000);
        } else if (status.status === "completed") {
          setBatch10xMessage(
            `10x分析完成！处理了 ${status.processedCount} 个issues，成功 ${status.successCount} 个，错误 ${status.errorCount} 个`
          );
          setIs10xAnalyzing(false);
          // 5秒后清除消息
          setTimeout(() => setBatch10xMessage(""), 8000);
        } else if (status.status === "cancelled") {
          setBatch10xMessage("10x分析已取消");
          setIs10xAnalyzing(false);
          setTimeout(() => setBatch10xMessage(""), 5000);
        }
      } catch (error) {
        console.error("Error polling 10x status:", error);
        setBatch10xMessage("10x状态检查失败，但分析可能仍在进行中");
        setIs10xAnalyzing(false);
      }
    };

    // 立即开始第一次轮询
    setTimeout(pollStatus, 500);
  }, [owner, repo]);

  // 取消10x分析
  const handleCancel10xBatchAnalysis = useCallback(async () => {
    try {
      const response = await fetch("/api/batch-analysis-10x", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: "cancel",
        }),
      });

      if (response.ok) {
        setBatch10xMessage("正在取消10x分析...");
      }
    } catch (error) {
      console.error("Error cancelling 10x batch analysis:", error);
    }
  }, [owner, repo]);

  // 继续10x分析（从暂停状态恢复）
  const handleResume10xBatchAnalysis = useCallback(async () => {
    try {
      setBatch10xMessage("正在恢复10x分析...");

      const response = await fetch("/api/batch-analysis-10x", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: "resume",
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setBatch10xMessage(
          `10x分析已恢复！将从 ${result.processedCount}/${result.totalCount} 继续，剩余 ${result.remainingCount} 个`
        );
        setIs10xAnalyzing(true);
        // 开始轮询状态
        start10xStatusPolling();
      } else {
        setBatch10xMessage(`恢复失败：${result.error}`);
      }
    } catch (error) {
      console.error("Error resuming 10x batch analysis:", error);
      setBatch10xMessage("恢复失败：网络错误或服务器错误");
    }
  }, [owner, repo, start10xStatusPolling]);

  // 检查10x分析状态
  const check10xBatchAnalysisStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/batch-analysis-10x", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: `${owner}/${repo}`,
          action: "status",
        }),
      });

      const status = await response.json();

      if (response.ok && status.status !== "not_started") {
        setBatchAnalysis10xStatus(status);

        if (status.status === "running") {
          console.log("🔄 检测到正在进行的10x分析，恢复状态和轮询");
          setBatch10xMessage(
            `10x并行处理中：${status.processedCount}/${status.totalCount} (成功：${status.successCount}, 错误：${status.errorCount})`
          );
          setIs10xAnalyzing(true);
          // 如果是运行状态，开始轮询
          start10xStatusPolling();
        } else if (status.status === "paused") {
          console.log("🔄 检测到暂停的10x分析，恢复暂停状态");
          setBatch10xMessage(
            `10x分析已暂停：${status.processedCount}/${status.totalCount} (成功：${status.successCount}, 错误：${status.errorCount})`
          );
          setIs10xAnalyzing(false);
        } else if (status.status === "completed") {
          console.log("🔄 检测到已完成的10x分析");
          setBatch10xMessage(
            `10x分析完成！处理了 ${status.processedCount} 个issues，成功 ${status.successCount} 个，错误 ${status.errorCount} 个`
          );
          setIs10xAnalyzing(false);
        }
      }
    } catch (error) {
      console.error("Error checking 10x batch analysis status:", error);
    }
  }, [owner, repo, start10xStatusPolling]);

  useEffect(() => {
    if (owner && repo) {
      fetchRepoData();
      // 检查是否有正在进行的批量分析
      checkBatchAnalysisStatus();
      // 检查是否有正在进行的10x分析
      check10xBatchAnalysisStatus();
    }
  }, [owner, repo, fetchRepoData, checkBatchAnalysisStatus, check10xBatchAnalysisStatus]);

  useEffect(() => {
    if (owner && repo) {
      fetchStats();
    }
  }, [owner, repo, fetchStats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading repository data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <GitBranch className="w-8 h-8" />
                {owner}/{repo}
              </h1>
              <p className="text-gray-600 mt-1">
                Issues and pull requests for this repository
              </p>
              {repoInfo && (
                <a
                  href={repoInfo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-2"
                >
                  View on GitHub
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* 按钮组 */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                {/* 根据状态显示不同的按钮组合 */}
                {(() => {
                  // @ts-ignore
                  const currentStatus = batchAnalysisStatus?.status;
                  // @ts-ignore
                  const current10xStatus = batchAnalysis10xStatus?.status;

                  // 优先检查10x分析状态
                  if (current10xStatus === "running") {
                    // 10x运行中：显示取消按钮
                    return (
                      <>
                        <button
                          onClick={handleCancel10xBatchAnalysis}
                          disabled={isAnalyzing}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          <X className="w-4 h-4" />
                          取消10x分析
                        </button>
                      </>
                    );
                  } else if (currentStatus === "running") {
                    // 普通分析运行中：显示暂停和取消按钮
                    return (
                      <>
                        <button
                          onClick={handlePauseBatchAnalysis}
                          disabled={isAnalyzing || is10xAnalyzing}
                          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          <Pause className="w-4 h-4" />
                          暂停分析
                        </button>
                        <button
                          onClick={handleCancelBatchAnalysis}
                          disabled={isAnalyzing || is10xAnalyzing}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          <X className="w-4 h-4" />
                          取消分析
                        </button>
                      </>
                    );
                  } else if (currentStatus === "paused") {
                    // 暂停中：显示继续、重试失败和取消按钮
                    return (
                      <>
                        <button
                          onClick={handleResume10xBatchAnalysis}
                          disabled={isAnalyzing || is10xAnalyzing}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          <Play className="w-4 h-4" />
                          10x继续分析
                        </button>
                        <button
                          onClick={handleResumeBatchAnalysis}
                          disabled={isAnalyzing || is10xAnalyzing}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          <Play className="w-4 h-4" />
                          继续分析
                        </button>
                        {/* 重试失败项目按钮 - 只在有失败项目时显示 */}
                        { (
                          <button
                            onClick={handleRetryFailedItems}
                            disabled={isAnalyzing || isBatchAnalyzing}
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            <RotateCcw className="w-4 h-4" />
                            重试失败
                          </button>
                        )}
                        <button
                          onClick={handleCancelBatchAnalysis}
                          disabled={isAnalyzing}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          <X className="w-4 h-4" />
                          取消分析
                        </button>
                      </>
                    );
                  } else {
                    // 默认状态或已完成状态：显示开始按钮和重试按钮（如果有失败项目）
                    return (
                      <>
                        <button
                          onClick={handle10xBatchAnalysis}
                          disabled={isAnalyzing || isBatchAnalyzing}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          <Brain className="w-4 h-4" />
                          10x全量AI分析
                        </button>
                        <button
                          onClick={handleBatchAnalysis}
                          disabled={isAnalyzing || is10xAnalyzing}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          <Brain className="w-4 h-4" />
                          全量AI打标分析
                        </button>
                        {/* 重试失败项目按钮 - 只在有失败项目时显示 */}
                        {batchAnalysisStatus?.errorCount && batchAnalysisStatus.errorCount > 0 && (
                          <button
                            onClick={handleRetryFailedItems}
                            disabled={isAnalyzing || isBatchAnalyzing}
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            <RotateCcw className="w-4 h-4" />
                            重试失败 ({batchAnalysisStatus.errorCount})
                          </button>
                        )}
                      </>
                    );
                  }
                })()}

                {/* 解析历史数据按钮 */}
                <button
                  onClick={handleAnalyzeHistoricalData}
                  disabled={isAnalyzing || isBatchAnalyzing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  {isAnalyzing ? "解析中..." : "解析历史数据"}
                </button>
              </div>

              {/* 状态消息 */}
              {(analysisMessage || batchMessage || batch10xMessage) && (
                <div className="flex flex-col gap-1">
                  {/* 历史数据解析消息 */}
                  {analysisMessage && (
                    <div
                      className={`text-sm px-3 py-2 rounded-lg ${
                        analysisMessage.includes("失败")
                          ? "bg-red-100 text-red-700"
                          : analysisMessage.includes("完成")
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {analysisMessage}
                    </div>
                  )}

                  {/* 10x并行AI分析消息 */}
                  {batch10xMessage && (
                    <div
                      className={`text-sm px-3 py-2 rounded-lg max-w-md ${
                        batch10xMessage.includes("失败") ||
                        batch10xMessage.includes("错误")
                          ? "bg-red-100 text-red-700"
                          : batch10xMessage.includes("完成")
                          ? "bg-green-100 text-green-700"
                          : batch10xMessage.includes("取消")
                          ? "bg-yellow-100 text-yellow-700"
                          : batch10xMessage.includes("暂停")
                          ? "bg-orange-100 text-orange-700"
                          : batch10xMessage.includes("恢复") ||
                            batch10xMessage.includes("继续")
                          ? "bg-blue-100 text-blue-700"
                          : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {is10xAnalyzing && (
                          <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                        )}
                        <span className="text-xs">{batch10xMessage}</span>
                      </div>
                      {/* 10x分析进度条 */}
                      {batchAnalysis10xStatus &&
                        is10xAnalyzing &&
                        batchAnalysis10xStatus?.totalCount > 0 && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${
                                    (batchAnalysis10xStatus.processedCount /
                                      batchAnalysis10xStatus.totalCount) *
                                    100
                                  }%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {/* 批量AI分析消息 */}
                  {batchMessage && (
                    <div
                      className={`text-sm px-3 py-2 rounded-lg max-w-md ${
                        batchMessage.includes("失败") ||
                        batchMessage.includes("错误")
                          ? "bg-red-100 text-red-700"
                          : batchMessage.includes("完成")
                          ? "bg-green-100 text-green-700"
                          : batchMessage.includes("取消")
                          ? "bg-yellow-100 text-yellow-700"
                          : batchMessage.includes("暂停")
                          ? "bg-orange-100 text-orange-700"
                          : batchMessage.includes("恢复") ||
                            batchMessage.includes("继续")
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isBatchAnalyzing && (
                          <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                        )}
                        <span className="text-xs">{batchMessage}</span>
                      </div>
                      {/* 进度条 */}
                      {batchAnalysisStatus &&
                        isBatchAnalyzing &&
                        batchAnalysisStatus?.totalCount > 0 && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${
                                    (batchAnalysisStatus.processedCount /
                                      batchAnalysisStatus.totalCount) *
                                    100
                                  }%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Statistics Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">
                      Total Issues
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.total}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Open</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.open}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Closed</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.closed}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <GitPullRequest className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">
                      Pull Requests
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.pull_requests}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Top Labels */}
          {stats &&
            stats.by_label &&
            Object.keys(stats.by_label).length > 0 && (
              <Card className="p-6 mb-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>Most Common Labels</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.by_label)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([label, count]) => (
                      <Badge key={label} variant="outline" className="text-sm">
                        {label} ({count})
                      </Badge>
                    ))}
                </div>
              </Card>
            )}
        </div>

        {/* Issues Table */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Issues & Pull Requests</h2>
          <IssueTableView
            issues={issues}
            pagination={pagination || undefined}
            loading={loading}
            onSearch={handleSearch}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
          />
        </Card>
      </div>
    </div>
  );
}
