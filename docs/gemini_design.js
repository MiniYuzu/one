import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, Settings, FileSpreadsheet, FileText, 
  Paperclip, Send, Loader2, CheckCircle2, XCircle, 
  FolderOpen, FileUp, Download, Eye, AlertCircle,
  Menu, PanelRight, ChevronDown, Zap, MessageCircle, BrainCircuit,
  Layout, Globe, Plus, Cpu, X, AtSign, Search, FolderKanban,
  Wrench, Copy, RotateCcw, ChevronUp, Bot, Sun, Moon
} from 'lucide-react';

// --- [Mock Data] ---
const WORKSPACES = [
  { id: 1, name: '四月销售数据分析', date: '今天', active: true },
  { id: 2, name: 'Q1 财务报表核算', date: '昨天', active: false },
  { id: 3, name: '新员工入职培训PPT', date: '3天前', active: false },
];

const ARTIFACTS = [
  { id: 1, name: '四月销售趋势分析.docx', type: 'word', size: '1.2 MB', time: '10:42' },
  { id: 2, name: '清洗后_源数据.xlsx', type: 'excel', size: '3.4 MB', time: '10:41' },
];

export default function App() {
  // --- [UI States] ---
  const [inputText, setInputText] = useState('');
  const [planStatus, setPlanStatus] = useState('pending');
  
  // Layout & Theme States
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false); // 深色模式开关
  
  // Config States
  const [selectedModel, setSelectedModel] = useState('Minimax 2.5');
  const [workMode, setWorkMode] = useState('Plan');
  const [rightTab, setRightTab] = useState('files');

  // Dropdown & Accordion States
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [isThoughtOpen, setIsThoughtOpen] = useState(true);

  const modeRef = useRef(null);
  const modelRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (modeRef.current && !modeRef.current.contains(event.target)) setShowModeDropdown(false);
      if (modelRef.current && !modelRef.current.contains(event.target)) setShowModelDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- [Components] ---

  // 左侧边栏
  const SidebarLeft = () => (
    <div className={`transition-all duration-300 ease-in-out flex flex-col h-screen bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-shrink-0 z-20 ${
      isLeftOpen ? 'w-64' : 'w-[68px]'
    }`}>
      {/* Logo 区域 */}
      <div className={`h-14 border-b border-slate-200 dark:border-slate-800 flex items-center transition-all duration-300 ${isLeftOpen ? 'px-4 justify-between' : 'justify-center'}`}>
        <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold text-lg overflow-hidden whitespace-nowrap">
          <Bot className="w-5 h-5 flex-shrink-0" />
          <span className={`transition-opacity duration-300 ${isLeftOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>AI Agent</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 flex flex-col">
        {/* 核心导航区 */}
        <div className="px-2 space-y-1 mb-4">
          <button className={`flex items-center text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition group ${isLeftOpen ? 'px-3 py-2 space-x-3 w-full' : 'p-3 justify-center mx-auto'}`} title="新建工作区">
            <Plus className="w-5 h-5 flex-shrink-0" />
            <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isLeftOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>新建工作区</span>
          </button>
          
          <button className={`flex items-center text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition group ${isLeftOpen ? 'px-3 py-2 space-x-3 w-full' : 'p-3 justify-center mx-auto'}`} title="全局搜索">
            <Search className="w-5 h-5 flex-shrink-0" />
            <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isLeftOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>全局搜索</span>
          </button>

          <button className={`flex items-center text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/10 rounded-lg transition group ${isLeftOpen ? 'px-3 py-2 space-x-3 w-full' : 'p-3 justify-center mx-auto'}`} title="我的工作区">
            <FolderKanban className="w-5 h-5 flex-shrink-0" />
            <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isLeftOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>我的工作区</span>
          </button>

          <button className={`flex items-center text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition group ${isLeftOpen ? 'px-3 py-2 space-x-3 w-full' : 'p-3 justify-center mx-auto'}`} title="本地工具库">
            <Wrench className="w-5 h-5 flex-shrink-0" />
            <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isLeftOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>本地工具库</span>
          </button>
        </div>

        {/* 历史列表 */}
        <div className={`transition-all duration-300 flex flex-col flex-1 overflow-hidden ${isLeftOpen ? 'opacity-100 h-auto' : 'opacity-0 h-0 hidden'}`}>
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-2 mt-2 px-5 uppercase tracking-wider">最近打开</div>
          <div className="space-y-0.5 px-2 flex-1 overflow-y-auto">
            {WORKSPACES.map(ws => (
              <div 
                key={ws.id} 
                title={ws.name}
                className={`rounded-md cursor-pointer flex items-center px-3 py-2 transition group ${
                  ws.active ? 'bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-200/50 dark:hover:bg-slate-800 border border-transparent text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center space-x-2.5 overflow-hidden">
                  <FolderOpen className={`w-4 h-4 flex-shrink-0 ${ws.active ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span className="text-sm truncate">
                    {ws.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部设置 */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-800">
        <button 
          className={`flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition ${isLeftOpen ? 'px-3 py-2 space-x-3 w-full' : 'p-3 justify-center mx-auto'}`}
          title="系统设置"
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isLeftOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>系统设置</span>
        </button>
      </div>
    </div>
  );

  // 右侧边栏：产物与预览视图
  const SidebarRight = () => (
    <div className={`transition-all duration-300 ease-in-out flex flex-col h-screen bg-white dark:bg-[#0F172A] border-l border-slate-200 dark:border-slate-800 flex-shrink-0 ${
      isRightOpen ? 'w-[320px]' : 'w-0 overflow-hidden border-none opacity-0'
    }`}>
      <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex items-center min-w-[20rem] space-x-1 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur">
        <button 
          onClick={() => setRightTab('files')}
          className={`flex-1 py-1.5 text-sm rounded-md transition font-medium ${rightTab === 'files' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'}`}
        >
          产物文件
        </button>
        <button 
          onClick={() => setRightTab('preview')}
          className={`flex-1 py-1.5 text-sm rounded-md transition font-medium flex items-center justify-center space-x-1 ${rightTab === 'preview' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'}`}
        >
           <Globe className="w-3.5 h-3.5" /> <span>在线预览</span>
        </button>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0B1120] min-w-[20rem]">
        {rightTab === 'files' ? (
          <>
            <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wider flex justify-between items-center">
              <span>生成结果</span>
              <span className="text-slate-400 dark:text-slate-500">{ARTIFACTS.length} 个文件</span>
            </div>
            <div className="space-y-3">
              {ARTIFACTS.map(file => (
                <div key={file.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col group hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-colors">
                  <div className="flex items-start space-x-3 mb-3">
                    {file.type === 'excel' ? (
                      <FileSpreadsheet className="w-8 h-8 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                    ) : (
                      <FileText className="w-8 h-8 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                    )}
                    <div className="overflow-hidden flex-1">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate" title={file.name}>{file.name}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{file.size} • {file.time}</div>
                    </div>
                  </div>
                  <div className="flex space-x-2 pt-2 border-t border-slate-50 dark:border-slate-700/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setRightTab('preview')}
                      className="flex-1 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 text-xs py-1.5 rounded flex items-center justify-center space-x-1 font-medium transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> <span>预览</span>
                    </button>
                    <button className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs py-1.5 rounded flex items-center justify-center space-x-1 font-medium transition-colors">
                      <Download className="w-3.5 h-3.5" /> <span>打开</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 space-y-4">
             <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-inner">
               <Layout className="w-8 h-8 stroke-1 text-slate-400 dark:text-slate-500" />
             </div>
             <div className="text-center">
               <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">暂无渲染内容</p>
               <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[200px]">请在文件列表中点击“预览”或等待 Agent 生成渲染视图。</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );

  // Plan 模式审批卡片组件
  const PlanCard = () => (
    <div className="my-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-700/30 rounded-xl overflow-hidden shadow-sm max-w-2xl">
      <div className="bg-amber-100/40 dark:bg-amber-800/20 px-4 py-2.5 border-b border-amber-100 dark:border-amber-700/30 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold text-amber-900 dark:text-amber-300 text-sm tracking-wide">执行计划待确认</span>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-4 font-medium">
          为了生成最终报告，我需要调用本地权限执行以下操作：
        </p>
        <div className="space-y-2 mb-5 bg-white dark:bg-slate-800/80 p-3 rounded-lg border border-amber-100/50 dark:border-amber-700/20">
          <div className="flex items-start space-x-2 text-sm text-slate-600 dark:text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
            <span>提取销售额前 10 的客户数据，并清洗异常值。</span>
          </div>
          <div className="flex items-start space-x-2 text-sm text-slate-600 dark:text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
            <span>在当前工作区覆写生成 <code className="bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 text-xs font-mono">四月销售趋势分析.docx</code>。</span>
          </div>
        </div>
        
        {planStatus === 'pending' && (
          <div className="flex space-x-3">
            <button 
              onClick={() => setPlanStatus('approved')}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg text-sm font-medium transition shadow-sm border border-amber-600/20"
            >
              批准执行
            </button>
            <button 
              onClick={() => setPlanStatus('rejected')}
              className="flex-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 py-2 rounded-lg text-sm font-medium transition"
            >
              拒绝
            </button>
          </div>
        )}

        {planStatus === 'approved' && (
          <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>执行已获授权。</span>
          </div>
        )}

        {planStatus === 'rejected' && (
          <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 text-sm font-medium">
            <XCircle className="w-4 h-4" />
            <span>执行已被拒绝。</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    // 使用外层包裹实现 Dark Mode 切换机制
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
        <SidebarLeft />
        
        {/* 中间主聊天区 */}
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0F172A] relative min-w-0 shadow-[0_0_15px_-3px_rgba(0,0,0,0.05)] dark:shadow-none border-x border-transparent dark:border-slate-800 z-10 transition-colors duration-300">
          
          {/* 顶部状态栏：绝对纯净的标题栏 */}
          <div className="h-14 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-3 bg-white dark:bg-[#0F172A] z-20 transition-colors duration-300">
            <div className="flex items-center space-x-2 overflow-hidden">
              <button 
                onClick={() => setIsLeftOpen(!isLeftOpen)}
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center text-sm whitespace-nowrap overflow-hidden">
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title="四月销售数据分析">四月销售数据分析</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 flex-shrink-0">
              <div className="flex items-center space-x-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-500/20 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span>直连</span>
              </div>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
              
              {/* 深色模式切换按钮 */}
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                title={isDarkMode ? "切换至浅色模式" : "切换至深色模式"}
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button 
                onClick={() => setIsRightOpen(!isRightOpen)}
                className={`p-1.5 rounded-md transition border ${isRightOpen ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                title="切换产物面板"
              >
                <PanelRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 聊天流区域 */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 pb-48 scroll-smooth">
            
            {/* User Message */}
            <div className="flex justify-end group">
              <div className="bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] sm:max-w-xl shadow-sm text-sm leading-relaxed relative">
                帮我分析一下刚才拖进去的销售数据 CSV，提取 Top 10 客户，然后生成一份带排版的 Word 总结报告。
                
                {/* 隐藏的悬浮操作按钮 */}
                <div className="absolute top-1 right-[102%] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col space-y-1">
                  <button className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 rounded-md transition">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* AI Message Chain */}
            <div className="flex items-start space-x-3 group">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-white dark:from-indigo-900/50 dark:to-slate-800 flex items-center justify-center flex-shrink-0 border border-indigo-200 dark:border-indigo-500/30 shadow-sm mt-0.5">
                <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 space-y-3 max-w-2xl min-w-0">
                
                {/* 可折叠的思维链 (Chain of Thought) */}
                <div className="border border-slate-200 dark:border-slate-700/60 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
                  <button 
                    onClick={() => setIsThoughtOpen(!isThoughtOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <BrainCircuit className="w-3.5 h-3.5" />
                      <span>执行过程 (3 步)</span>
                    </div>
                    <ChevronUp className={`w-3.5 h-3.5 transition-transform duration-300 ${isThoughtOpen ? '' : 'rotate-180'}`} />
                  </button>
                  
                  <div className={`transition-all duration-300 ease-in-out border-t border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/50 ${isThoughtOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0 border-t-0'}`}>
                    <div className="p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                          <span>读取 <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono">raw_sales_data.csv</code></span>
                        </div>
                        <span className="text-slate-400 dark:text-slate-500">0.2s</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                          <span>数据清洗与透视分析</span>
                        </div>
                        <span className="text-slate-400 dark:text-slate-500">1.4s</span>
                      </div>
                      {planStatus === 'pending' ? (
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-medium">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>挂起：等待计划审批...</span>
                          </div>
                        </div>
                      ) : planStatus === 'approved' ? (
                         <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                            <span>生成最终 Word 排版</span>
                          </div>
                          <span className="text-slate-400 dark:text-slate-500">2.1s</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* 核心 Plan 卡片 */}
                <PlanCard />

                {/* AI Final Message */}
                {planStatus === 'approved' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
                    <div className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                      报告已生成完毕！我提取了销售额排名前十的客户数据，并使用了标准的行内公文格式为您排版了 Word 文档。您现在可以在右侧的面板中直接打开或预览。
                    </div>
                    
                    {/* AI 消息操作栏 */}
                    <div className="flex items-center space-x-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded transition" title="复制结果">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded transition" title="重新生成">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 底部输入区 - Cursor 风格极致优化的 Unified Console */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/90 dark:from-[#0F172A] dark:via-[#0F172A]/90 to-transparent pt-12 pb-6 px-4 sm:px-8 z-30 pointer-events-none transition-colors duration-300">
            <div className="max-w-3xl mx-auto shadow-2xl shadow-slate-300/40 dark:shadow-black/60 rounded-[20px] pointer-events-auto bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex flex-col focus-within:ring-4 focus-within:ring-indigo-50 dark:focus-within:ring-indigo-500/10 focus-within:border-indigo-300 dark:focus-within:border-indigo-500/50 transition-all duration-300">
              
              {/* Context Pills (上下文胶囊区) */}
              <div className="px-3 pt-3 pb-0 flex flex-wrap gap-2">
                <div className="flex items-center space-x-1 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100/60 dark:border-emerald-500/20 rounded-md px-2 py-1 max-w-[200px] group transition-colors">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium truncate">raw_sales_data.csv</span>
                  <button className="opacity-0 group-hover:opacity-100 text-emerald-400 dark:text-emerald-500 hover:text-rose-500 dark:hover:text-rose-400 transition ml-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 输入框主体 */}
              <div className="relative px-1">
                <textarea 
                  rows={2}
                  className="w-full resize-none bg-transparent border-0 focus:ring-0 px-3 py-2.5 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-[15px] leading-relaxed"
                  placeholder="描述需求，使用 @ 引用文件或对话..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
              </div>
              
              {/* 底部控制中枢 (Control Console) */}
              <div className="flex items-center justify-between px-2 pb-2 pt-1 border-t border-slate-50/50 dark:border-slate-700/50 mt-1">
                <div className="flex items-center space-x-1.5">
                  
                  {/* 1. 模式切换 (动作主导) */}
                  <div className="relative" ref={modeRef}>
                    <button 
                      onClick={() => setShowModeDropdown(!showModeDropdown)}
                      className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                        workMode === 'Craft' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/30' : 
                        workMode === 'Plan' ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/30' :
                        'bg-slate-100/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-600/80'
                      }`}
                    >
                      {workMode === 'Ask' && <MessageCircle className="w-3.5 h-3.5" />}
                      {workMode === 'Craft' && <Zap className="w-3.5 h-3.5" />}
                      {workMode === 'Plan' && <BrainCircuit className="w-3.5 h-3.5" />}
                      <span>{workMode}</span>
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </button>

                    {showModeDropdown && (
                      <div className="absolute bottom-full left-0 mb-2 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-50 overflow-hidden origin-bottom-left animate-in zoom-in-95 duration-100">
                        {[
                          { id: 'Ask', icon: MessageCircle, name: '问一问', desc: '纯对话，只读安全模式' },
                          { id: 'Plan', icon: BrainCircuit, name: '想一想', desc: '拟定计划，需人工确认' },
                          { id: 'Craft', icon: Zap, name: '做一做', desc: '全自动执行，无需确认' }
                        ].map(m => (
                          <button
                            key={m.id}
                            onClick={() => { setWorkMode(m.id); setShowModeDropdown(false); }}
                            className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition flex flex-col ${workMode === m.id ? 'bg-indigo-50/40 dark:bg-indigo-500/10' : ''}`}
                          >
                            <div className="flex items-center space-x-2">
                              <m.icon className={`w-4 h-4 ${
                                m.id === 'Craft' ? 'text-indigo-600 dark:text-indigo-400' : m.id === 'Plan' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'
                              }`} />
                              <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{m.id}</span>
                              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">({m.name})</span>
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 ml-6">{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. 模型切换 (智力支撑) */}
                  <div className="relative" ref={modelRef}>
                    <button 
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                      className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-700/60 transition"
                      title="选择 AI 模型"
                    >
                      <Cpu className="w-3.5 h-3.5 opacity-70" />
                      <span>{selectedModel}</span>
                      <ChevronDown className="w-3 h-3 opacity-40" />
                    </button>
                    {showModelDropdown && (
                      <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-50 origin-bottom-left animate-in zoom-in-95 duration-100">
                        {['Minimax 2.5', 'GPT-4o (内网)', 'Claude 3.5'].map(m => (
                          <button
                            key={m}
                            onClick={() => { setSelectedModel(m); setShowModelDropdown(false); }}
                            className={`w-full text-left px-3 py-2 text-sm transition flex items-center justify-between ${selectedModel === m ? 'text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50/50 dark:bg-indigo-500/10' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                          >
                            <span>{m}</span>
                            {selectedModel === m && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

                  {/* 3. 核心生产力工具：@上下文 与 附件 */}
                  <button className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-700/60 transition" title="引入上下文 (如文件、历史对话)">
                    <AtSign className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">引入</span>
                  </button>
                  <button className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-700/60 rounded-md transition" title="上传本地文件">
                    <Paperclip className="w-4 h-4" />
                  </button>
                </div>

                {/* 发送按钮 */}
                <button className={`flex items-center justify-center p-2 rounded-xl transition ${
                  inputText ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}>
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </div>
            
            <div className="text-center mt-3 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              AI 可能会犯错。处理涉及财务或敏感数据前，请核实生成内容。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}