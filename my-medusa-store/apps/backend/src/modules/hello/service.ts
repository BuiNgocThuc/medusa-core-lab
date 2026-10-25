import {MedusaService} from "@medusajs/framework/utils"
import {CustomHello} from "./models/custom"

export default class HelloModuleService extends MedusaService ({
     Custom: CustomHello
}) {}