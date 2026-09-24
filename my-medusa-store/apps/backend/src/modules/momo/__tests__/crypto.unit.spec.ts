import {
  buildCreatePaymentSignatureData,
  buildIpnSignatureData,
  buildQuerySignatureData,
  signMomoPayload,
  timingSafeStringEqual,
} from "../crypto"

describe("MoMo crypto helpers", () => {
  it("builds create-payment signature data in MoMo field order", () => {
    expect(
      buildCreatePaymentSignatureData({
        accessKey: "access",
        amount: 10000,
        extraData: "extra",
        ipnUrl: "https://backend.test/hooks/payment/momo_default",
        orderId: "MM123",
        orderInfo: "Order MM123",
        partnerCode: "MOMO",
        redirectUrl: "https://storefront.test/api/payment-return/momo",
        requestId: "MR123",
        requestType: "captureWallet",
      })
    ).toBe(
      "accessKey=access&amount=10000&extraData=extra&ipnUrl=https://backend.test/hooks/payment/momo_default&orderId=MM123&orderInfo=Order MM123&partnerCode=MOMO&redirectUrl=https://storefront.test/api/payment-return/momo&requestId=MR123&requestType=captureWallet"
    )
  })

  it("builds IPN signature data in MoMo field order", () => {
    expect(
      buildIpnSignatureData({
        accessKey: "access",
        amount: 10000,
        extraData: "",
        message: "Successful.",
        orderId: "MM123",
        orderInfo: "Order MM123",
        orderType: "momo_wallet",
        partnerCode: "MOMO",
        payType: "qr",
        requestId: "MR123",
        responseTime: 1710000000000,
        resultCode: 0,
        transId: 123456789,
      })
    ).toBe(
      "accessKey=access&amount=10000&extraData=&message=Successful.&orderId=MM123&orderInfo=Order MM123&orderType=momo_wallet&partnerCode=MOMO&payType=qr&requestId=MR123&responseTime=1710000000000&resultCode=0&transId=123456789"
    )
  })

  it("builds query signature data in MoMo field order", () => {
    expect(
      buildQuerySignatureData({
        accessKey: "access",
        orderId: "MM123",
        partnerCode: "MOMO",
        requestId: "MR123",
      })
    ).toBe("accessKey=access&orderId=MM123&partnerCode=MOMO&requestId=MR123")
  })

  it("signs and compares HMAC strings safely", () => {
    const signature = signMomoPayload("amount=10000&orderId=MM123", "secret")

    expect(signature).toBe(
      "3c74d84253d869d9167d9a881e5205fbfe77425ca7437d82895fe900fd989d93"
    )
    expect(timingSafeStringEqual(signature, signature)).toBe(true)
    expect(timingSafeStringEqual(signature, `${signature}0`)).toBe(false)
    expect(timingSafeStringEqual(signature, undefined)).toBe(false)
  })
})
