import {model} from "@medusajs/framework/utils"
export const CustomHello = model.define ("custom", {
    id: model.id().primaryKey(),
    custom_name: model.text(),
  })

  