// src/modules/hello/index.ts
import { Module } from "@medusajs/framework/utils"
import HelloModuleService  from "./service"  

export const HELLO_MODULE = "hello"
export default Module(HELLO_MODULE,{
  service: HelloModuleService,
})