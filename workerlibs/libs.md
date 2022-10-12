项目	简介	构建打包	底层API封装	跨线程调用申明	可用性监控	易拓展性
comlink	Chrome 团队, 通信 RPC 封装	✘	✔️	同名函数(基于Proxy)	✘	✘
workerize-loader	社区目前比较完整的方案	✔️	✔️	同名函数(基于AST生成)	✘	✘
alloy-worker	面向事务的高可用 Worker 通信框架	提供构建脚本	通信️控制器	同名函数(基于约定), TS 声明	完整监控指标, 全周期错误监控	命名空间, 事务生成脚本