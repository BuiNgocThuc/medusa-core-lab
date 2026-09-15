import { defineLink } from "@medusajs/framework/utils";
import HelloModule from "../modules/hello";
import CartModule from "@medusajs/medusa/cart"

export default defineLink(
    CartModule.linkable.cart,
    HelloModule.linkable.custom,
)