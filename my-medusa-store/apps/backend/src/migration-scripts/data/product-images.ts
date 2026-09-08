import { loadEnv, defineConfig } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

const DOMAIN = process.env.S3_FILE_URL;

export const R2_IMAGES: Record<
  string,
  { thumbnail: string; images: string[] }
> = {
  "yonex-mavis-350-1tube": {
    thumbnail: `${DOMAIN}/ong-cau-long-nhua-yonex-mav-350-6-in-1-vang-1-01KWZYC5K226KE07PKSNK2D675-01KYGYEW06HDEDM1JHXQAZN320.webp`,
    images: [
      `${DOMAIN}/ong-cau-long-nhua-yonex-mav-350-6-in-1-vang-1-01KWZYC5K226KE07PKSNK2D675-01KYGYEW06HDEDM1JHXQAZN320.webp`,
    ],
  },
  "yonex-as30-1tube": {
    thumbnail: `${DOMAIN}/Ong-cau-long-Yonex-Aerosensa-30-600x600-01KWZYFBD5VYAB1G7DNRRGJWG1-01KYGYEX2B4HP2T7KH6SA6ABTJ.jpg`,
    images: [
      `${DOMAIN}/Ong-cau-long-Yonex-Aerosensa-30-600x600-01KWZYFBD5VYAB1G7DNRRGJWG1-01KYGYEX2B4HP2T7KH6SA6ABTJ.jpg`,
    ],
  },
  "yonex-as50-1tube": {
    thumbnail: `${DOMAIN}/ong-cau-long-yonex-as50-1-01KXFVG6HHA1X1QXWPSG0WX3GC-01KYGYEXMMMANHT7AWPQFWYZFH.webp`,
    images: [
      `${DOMAIN}/ong-cau-long-yonex-as50-1-01KXFVG6HHA1X1QXWPSG0WX3GC-01KYGYEXMMMANHT7AWPQFWYZFH.webp`,
    ],
  },
  "yonex-mavis-2000-1tube": {
    thumbnail: `${DOMAIN}/793b939d-322a-4a84-87d5-fb2b64ae2e0c-01KXFVEKFXF6YRS041H53QTFAF-01KYGYEYEE1E16D0723BHG2SRY.png`,
    images: [
      `${DOMAIN}/793b939d-322a-4a84-87d5-fb2b64ae2e0c-01KXFVEKFXF6YRS041H53QTFAF-01KYGYEYEE1E16D0723BHG2SRY.png`,
    ],
  },
  "lining-a62-1tube": {
    thumbnail: `${DOMAIN}/e8a4f680-7656-41b0-86b7-a96acc926bed-01KXFVCYH2J83QGPHMJG34ZY6N-01KYGYEZ5J1W0XDQGVKCMEED89.png`,
    images: [
      `${DOMAIN}/e8a4f680-7656-41b0-86b7-a96acc926bed-01KXFVCYH2J83QGPHMJG34ZY6N-01KYGYEZ5J1W0XDQGVKCMEED89.png`,
    ],
  },
  "lining-a62": {
    thumbnail: `${DOMAIN}/lining_a62_xd_renewed_shuttlecock_1560791902_e9d4ef11_progressive-01KXFSFVK6JECNVR8D20T2G5SV-01KYGYEZNFP1CQJ8RNTDEC24XC.jpg`,
    images: [
      `${DOMAIN}/lining_a62_xd_renewed_shuttlecock_1560791902_e9d4ef11_progressive-01KXFSFVK6JECNVR8D20T2G5SV-01KYGYEZNFP1CQJ8RNTDEC24XC.jpg`,
    ],
  },
  "lining-a62-3tube": {
    thumbnail: `${DOMAIN}/27e7f22e-0d7f-47f2-8e80-ecc6542534a0-01KXFSQQSK8NBQS5M9GBV6BPDZ-01KYGYF04EKXAV1GMCAYG25TX1.png`,
    images: [
      `${DOMAIN}/27e7f22e-0d7f-47f2-8e80-ecc6542534a0-01KXFSQQSK8NBQS5M9GBV6BPDZ-01KYGYF04EKXAV1GMCAYG25TX1.png`,
    ],
  },
  "yonex-as50": {
    thumbnail: `${DOMAIN}/vn-11134207-820l4-mi44fjmre1378f-01KXFSJ5HT8JK4YAKD8TXYTGGX-01KYGYF0PVYBHYDYK4ESX5SY3A.jpeg`,
    images: [
      `${DOMAIN}/vn-11134207-820l4-mi44fjmre1378f-01KXFSJ5HT8JK4YAKD8TXYTGGX-01KYGYF0PVYBHYDYK4ESX5SY3A.jpeg`,
    ],
  },
  "yonex-as50-3tube": {
    thumbnail: `${DOMAIN}/vn-11134207-820l4-mjl16e5s5csk95-01KXFSM3NS18ATDWJ9H54ZAPEX-01KYGYF16ZWF1E1XX36P0BBR95.webp`,
    images: [
      `${DOMAIN}/vn-11134207-820l4-mjl16e5s5csk95-01KXFSM3NS18ATDWJ9H54ZAPEX-01KYGYF16ZWF1E1XX36P0BBR95.webp`,
    ],
  },
  "yonex-mavis-2000": {
    thumbnail: `${DOMAIN}/vn-11134207-81ztc-mmnwvnviexom87%40resize_w450_nl-01KXFSGWAXGQ7ZYYQSD5FEJY1P-01KYGYF1Q59V6RS7AVJDDN30WA.webp`,
    images: [
      `${DOMAIN}/vn-11134207-81ztc-mmnwvnviexom87%40resize_w450_nl-01KXFSGWAXGQ7ZYYQSD5FEJY1P-01KYGYF1Q59V6RS7AVJDDN30WA.webp`,
    ],
  },
  "yonex-mavis-2000-3tube": {
    thumbnail: `${DOMAIN}/f00898e1-9342-4f3b-84c2-f90c5f89fdbf-01KXFSS7RTXHB4W0W2SVNGY8NX-01KYGYF256VFQKSQCHRGJ4ZXAG.png`,
    images: [
      `${DOMAIN}/f00898e1-9342-4f3b-84c2-f90c5f89fdbf-01KXFSS7RTXHB4W0W2SVNGY8NX-01KYGYF256VFQKSQCHRGJ4ZXAG.png`,
    ],
  },
  "yonex-mavis-350-3tube": {
    thumbnail: `${DOMAIN}/vn-11134207-820l4-mjjkscxq9hqe92-01KXFSN29GPKYTBTCBP3HT825V-01KYGYF2YBR2AGFDTFNNS0DWS8.webp`,
    images: [
      `${DOMAIN}/vn-11134207-820l4-mjjkscxq9hqe92-01KXFSN29GPKYTBTCBP3HT825V-01KYGYF2YBR2AGFDTFNNS0DWS8.webp`,
    ],
  },
  "lining-axforce-80": {
    thumbnail: `${DOMAIN}/vot-cau-long-lining-axforce-80-chinh-hang-2-01KWZX5NPV1VRVYYHV4226868X-01KYGYF3TPYRC0MMRACQ3HBA69.webp`,
    images: [
      `${DOMAIN}/vot-cau-long-lining-axforce-80-chinh-hang-1-01KWZX5NPT9YYH8K60DZ7TVXM9-01KYGYF3CPJYX4JCEFZBFJBY5E.webp`,
      `${DOMAIN}/vot-cau-long-lining-axforce-80-chinh-hang-2-01KWZX5NPV1VRVYYHV4226868X-01KYGYF3TPYRC0MMRACQ3HBA69.webp`,
    ],
  },
  "lining-no1-string": {
    thumbnail: `${DOMAIN}/day-cuoc-cang-vot-lining-no-1-1-01KWZYQQT33B16DFYRPE9DYRWF-01KYGYF4AM6RJXFV99899ADSTK.webp`,
    images: [
      `${DOMAIN}/day-cuoc-cang-vot-lining-no-1-1-01KWZYQQT33B16DFYRPE9DYRWF-01KYGYF4AM6RJXFV99899ADSTK.webp`,
    ],
  },
  "lining-ranger": {
    thumbnail: `${DOMAIN}/giay-ranger-7lite-01KWZYBHGJ0ZAKFQEG9ZFMCV7V-01KYGYF4T1WQ1F64DAYQ7K4G71.webp`,
    images: [
      `${DOMAIN}/giay-ranger-7lite-01KWZYBHGJ0ZAKFQEG9ZFMCV7V-01KYGYF4T1WQ1F64DAYQ7K4G71.webp`,
      `${DOMAIN}/giay-ranger-7l-01KWZYBHGJ6M6E9NR3WT31X6T1-01KYGYF5856G00XAN2ABT6TDX7.webp`,
    ],
  },
  "victor-a970": {
    thumbnail: `${DOMAIN}/giay-cau-long-victor-a970-nl-a-chinh-hang-1_1761591589-01KWZXSTAHZGGS62GREN2PGX4E-01KYGYF66WWVJTVGE6W5F14THE.webp`,
    images: [
      `${DOMAIN}/giay-cau-long-victor-a970-nl-a-chinh-hang-2_1761591596-01KWZXSTAGGY0BF9RJPRKNMM4B-01KYGYF5PHBQNSVTEAEJ516JXN.webp`,
      `${DOMAIN}/giay-cau-long-victor-a970-nl-a-chinh-hang-1_1761591589-01KWZXSTAHZGGS62GREN2PGX4E-01KYGYF66WWVJTVGE6W5F14THE.webp`,
      `${DOMAIN}/giay-cau-long-victor-a970-nl-a-chinh-hang_1761591584-01KWZXSTAHS72D9X9XNQXDH3N2-01KYGYF6NSWKAPZWE1TE5DFGNE.webp`,
    ],
  },
  "victor-auraspeed-90k": {
    thumbnail: `${DOMAIN}/vot-cau-long-victor-ars-90k-chinh-hang-1-01KXDHRRMF7SD3PBPEQ5J98NWD-01KYGYF74WFPET04MF457AACFE.webp`,
    images: [
      `${DOMAIN}/vot-cau-long-victor-ars-90k-chinh-hang-1-01KXDHRRMF7SD3PBPEQ5J98NWD-01KYGYF74WFPET04MF457AACFE.webp`,
    ],
  },
  "victor-br9111-bag": {
    thumbnail: `${DOMAIN}/Bao-vot-cau-long-Victor-BR9211-C-2-01KXDJ1PQE990ZEA1BC80N3ZWS-01KYGYF7KXDG5Y3608QSHFWNV5.webp`,
    images: [
      `${DOMAIN}/Bao-vot-cau-long-Victor-BR9211-C-2-01KXDJ1PQE990ZEA1BC80N3ZWS-01KYGYF7KXDG5Y3608QSHFWNV5.webp`,
    ],
  },
  "victor-br9213-bag": {
    thumbnail: `${DOMAIN}/vn-11134207-820l4-mf942cr2bk0cc6%40resize_w450_nl-01KWZYJD620GMQX2K9YXYZCP4C-01KYGYF85AZWJBX9J4HVGX7RC8.webp`,
    images: [
      `${DOMAIN}/vn-11134207-820l4-mf942cr2bk0cc6%40resize_w450_nl-01KWZYJD620GMQX2K9YXYZCP4C-01KYGYF85AZWJBX9J4HVGX7RC8.webp`,
    ],
  },
  "victor-gr262-grip": {
    thumbnail: `${DOMAIN}/quan-can-vot-cau-long-victor-gr262drm-xanh_1741312232-01KWZXVGQAF5RBDY1957VDZ8Q4-01KYGYF8KYJ9XRXYK5R1ADEY2P.webp`,
    images: [
      `${DOMAIN}/quan-can-vot-cau-long-victor-gr262drm-xanh_1741312232-01KWZXVGQAF5RBDY1957VDZ8Q4-01KYGYF8KYJ9XRXYK5R1ADEY2P.webp`,
    ],
  },
  "victor-sk155-socks": {
    thumbnail: `${DOMAIN}/VictorMen_sSportsSocksSK155D_Red-01KWZYSFBM6FK0B89AWZEG0JC1-01KYGYF915EK06CGQHV52670J2.webp`,
    images: [
      `${DOMAIN}/VictorMen_sSportsSocksSK155D_Red-01KWZYSFBM6FK0B89AWZEG0JC1-01KYGYF915EK06CGQHV52670J2.webp`,
    ],
  },
  "victor-thruster-ryuga-2": {
    thumbnail: `${DOMAIN}/vot-cau-long-victor-ryuga-ii-chinh-hang-5-01KWZX6J88RZTYNMV5EGFRYC8V-01KYGYFAARKAZATK652XFNK5D0.webp`,
    images: [
      `${DOMAIN}/vot-cau-long-victor-ryuga-ii-chinh-hang-1-01KWZX6J877PSZ4XQAG0WMN0EN-01KYGYF9EJJQZH07NEYV0QQX4B.webp`,
      `${DOMAIN}/vot-cau-long-victor-ryuga-ii-chinh-hang-4-01KWZX6J883AWH06YRG9ZXWS9R-01KYGYF9WQS2BSQEJ1MPASJDWD.webp`,
      `${DOMAIN}/vot-cau-long-victor-ryuga-ii-chinh-hang-5-01KWZX6J88RZTYNMV5EGFRYC8V-01KYGYFAARKAZATK652XFNK5D0.webp`,
    ],
  },
  "victor-vbs-63": {
    thumbnail: `${DOMAIN}/day-cuoc-cang-vot-victor-vs-63cs-am_1711072058-01KXDJ8NQN9P8D6J0AVYFW70G7-01KYGYFAVBT4JF17RWXN9ND0NN.webp`,
    images: [
      `${DOMAIN}/day-cuoc-cang-vot-victor-vs-63cs-am_1711072058-01KXDJ8NQN9P8D6J0AVYFW70G7-01KYGYFAVBT4JF17RWXN9ND0NN.webp`,
    ],
  },
  "yonex-ac102-towel-grip": {
    thumbnail: `${DOMAIN}/sg-11134201-824ji-mpriigsn1ji8cb-01KWZYN112BQB4RBBRDZF4QNW4-01KYGYFBAVJ3BQQN8HCH1SSN9J.webp`,
    images: [
      `${DOMAIN}/sg-11134201-824ji-mpriigsn1ji8cb-01KWZYN112BQB4RBBRDZF4QNW4-01KYGYFBAVJ3BQQN8HCH1SSN9J.webp`,
    ],
  },
  "yonex-ac105-grip": {
    thumbnail: `${DOMAIN}/vn-11134207-7ra0g-m75z7t9x45up67%40resize_w450_nl-01KXDHWAG17CZ4A975Q5NV7PMV-01KYGYFBSXM7D9KWJVTTCHGD2T.webp`,
    images: [
      `${DOMAIN}/vn-11134207-7ra0g-m75z7t9x45up67%40resize_w450_nl-01KXDHWAG17CZ4A975Q5NV7PMV-01KYGYFBSXM7D9KWJVTTCHGD2T.webp`,
    ],
  },
  "yonex-aerobite": {
    thumbnail: `${DOMAIN}/day-cuoc-cang-vot-yonex-bg-aerobite-1-01KXDHP6NG31NNPFCST69YY6YJ-01KYGYFCH7WFHJKMBPBVCMC5JD.webp`,
    images: [
      `${DOMAIN}/day-cuoc-cang-vot-yonex-bg-aerobite-1-01KXDHP6NG31NNPFCST69YY6YJ-01KYGYFCH7WFHJKMBPBVCMC5JD.webp`,
    ],
  },
  "yonex-as30": {
    thumbnail: `${DOMAIN}/Ong-cau-long-Yonex-Aerosensa-30-2-600x600-01KWZYFBD5A5P0ST6M8ZCGGDT8-01KYGYFCZQX3TF1A4J6HSNXBB0.jpg`,
    images: [
      `${DOMAIN}/Ong-cau-long-Yonex-Aerosensa-30-2-600x600-01KWZYFBD5A5P0ST6M8ZCGGDT8-01KYGYFCZQX3TF1A4J6HSNXBB0.jpg`,
      `${DOMAIN}/Ong-cau-long-Yonex-Aerosensa-30-600x600-01KWZYFBD5VYAB1G7DNRRGJWG1-01KYGYEX2B4HP2T7KH6SA6ABTJ.jpg`,
    ],
  },
  "yonex-as30-3tube": {
    thumbnail: `${DOMAIN}/ong-cau-long-yonex-as30-1-01KWZXXAWDQGSH5HD7697DF91N-01KYGYFDE3BQ078M3AW0H76TFY.webp`,
    images: [
      `${DOMAIN}/ong-cau-long-yonex-as30-1-01KWZXXAWDQGSH5HD7697DF91N-01KYGYFDE3BQ078M3AW0H76TFY.webp`,
    ],
  },
  "yonex-astrox-88d-pro": {
    thumbnail: `${DOMAIN}/vot-cau-long-yonex-astrox-88d-pro-2024-chinh-hang_1710988318-01KXDHQQAQDR1Y34ABZWZWDR0M-01KYGYFEDVXNCJZQ2DSR1YD6VZ.webp`,
    images: [
      `${DOMAIN}/vot-cau-long-yonex-astrox-88d-pro-2024-chinh-hang_1711052539-01KXDHQQAP0H148YVK8WREWYKB-01KYGYFDZFMYEA7S3D7SM7P9KN.webp`,
      `${DOMAIN}/vot-cau-long-yonex-astrox-88d-pro-2024-chinh-hang_1710988318-01KXDHQQAQDR1Y34ABZWZWDR0M-01KYGYFEDVXNCJZQ2DSR1YD6VZ.webp`,
    ],
  },
  "yonex-astrox-99-pro": {
    thumbnail: `${DOMAIN}/vot-cau-long-yonex-astrox-99-pro-trang-ma-jp_1695687382-01KWZXTNGM2X0MZXR2HZYPDH3B-01KYGYFGHKQPC8D3SHB77PKCBP.webp`,
    images: [
      `${DOMAIN}/vot-cau-long-yonex-astrox-99-pro-trang-ma-jp-2_1695687401-01KWZXTNGJ1KJ2J2CWMYNT2K9T-01KYGYFEWSQ6TRC6FG4QT7V53N.webp`,
      `${DOMAIN}/vot-cau-long-yonex-astrox-99-pro-trang-ma-jp-3_1695687409-01KWZXTNGKWDAQ0NMV671058KV-01KYGYFFBV8W10VBQ9RP19EC72.webp`,
      `${DOMAIN}/vot-cau-long-yonex-astrox-99-pro-trang-ma-jp-1_1695687393-01KWZXTNGMZNKR4KKAJNFMNS86-01KYGYFFVAVJ616M5H352DS9HA.webp`,
      `${DOMAIN}/vot-cau-long-yonex-astrox-99-pro-trang-ma-jp_1695687382-01KWZXTNGM2X0MZXR2HZYPDH3B-01KYGYFGHKQPC8D3SHB77PKCBP.webp`,
    ],
  },
  "yonex-bg65": {
    thumbnail: `${DOMAIN}/day-cang-cuoc-vot-yonex-bg65-1-01KWZWXTGB5SK1GK82YG5G92SY-01KYGYFHHPBJN5F9PDX4GQRPSX.webp`,
    images: [
      `${DOMAIN}/day-cang-cuoc-vot-yonex-bg65-2-01KWZWXTG7SBE95FHR56ZXWCGC-01KYGYFH1DTTAEA9Y0K5DFP2PY.webp`,
      `${DOMAIN}/day-cang-cuoc-vot-yonex-bg65-1-01KWZWXTGB5SK1GK82YG5G92SY-01KYGYFHHPBJN5F9PDX4GQRPSX.webp`,
    ],
  },
  "yonex-bg80-power": {
    thumbnail: `${DOMAIN}/day-cuoc-cang-vot-yonex-bg80-power-1-01KWZX3R30WNJWKZMATY60372H-01KYGYFJ2N078PD2T11796EEHN.webp`,
    images: [
      `${DOMAIN}/day-cuoc-cang-vot-yonex-bg80-power-1-01KWZX3R30WNJWKZMATY60372H-01KYGYFJ2N078PD2T11796EEHN.webp`,
    ],
  },
  "yonex-mavis-350": {
    thumbnail: `${DOMAIN}/ong-cau-long-nhua-yonex-mav-350-6-in-1-vang-1-01KWZYC5K226KE07PKSNK2D675-01KYGYEW06HDEDM1JHXQAZN320.webp`,
    images: [
      `${DOMAIN}/ong-cau-long-nhua-yonex-mav-350-6-in-1-vang-1-01KWZYC5K226KE07PKSNK2D675-01KYGYEW06HDEDM1JHXQAZN320.webp`,
    ],
  },
  "yonex-nanoflare-800": {
    thumbnail: `${DOMAIN}/vot-cau-long-yonex-nanoflare-800-4-01KWZX1G1AHH7QKNRM4VM1EQAV-01KYGYFKVZPY4XWTJXCG11TWSV.webp`,
    images: [
      `${DOMAIN}/vot-cau-long-yonex-nanoflare-800-3-01KWZX1G17DGFA2E101JKDFDPX-01KYGYFJHF6ZT6GW84Y8MGEZDY.webp`,
      `${DOMAIN}/vot-cau-long-yonex-nanoflare-800-2-01KWZX1G18P4H4SGN15N1WDCX6-01KYGYFK1Z0FKXY2GSTFRMW7TA.webp`,
      `${DOMAIN}/vot-cau-long-yonex-nanoflare-800-1-01KWZX1G18P386J8G08N0AC9FZ-01KYGYFKEW4QP84CP22TRMZG50.webp`,
      `${DOMAIN}/vot-cau-long-yonex-nanoflare-800-4-01KWZX1G1AHH7QKNRM4VM1EQAV-01KYGYFKVZPY4XWTJXCG11TWSV.webp`,
    ],
  },
  "yonex-pc-65z3": {
    thumbnail: `${DOMAIN}/giay-cau-long-yonex-65z3-trang-do-jp-noi-dia-nhat-_1726081176-01KWZYG0WZ5XTH5XTGWK9S6J75-01KYGYFN6BV2T9JAFME5XFW82J.webp`,
    images: [
      `${DOMAIN}/giay-cau-long-yonex-65z3-trang-do-jp-noi-dia-nhat--1-01KWZYG0WYH4Q7CQ2WVWXM9JEK-01KYGYFMKJS0QR5709V0P4F4V3.webp`,
      `${DOMAIN}/giay-cau-long-yonex-65z3-trang-do-jp-noi-dia-nhat-_1726081176-01KWZYG0WZ5XTH5XTGWK9S6J75-01KYGYFN6BV2T9JAFME5XFW82J.webp`,
    ],
  },
  "yonex-pc-insole": {
    thumbnail: `${DOMAIN}/Yonex-AC195EX-Power-Cushion-Plus-Insole_-191740549-01KWZYYG19JKNZGMMWAAQESP0A-01KYGYFQ6SYWGMSZ1TZ6P4DKG4.webp`,
    images: [
      `${DOMAIN}/Yonex-AC195EX-Power-Cushion-Plus-Insole_-43675815-01KWZYYG188X90KS9S08QMQYG4-01KYGYFNP71F0W67DW1ZQHZP1H.webp`,
      `${DOMAIN}/Yonex-AC195EX-Power-Cushion-Plus-Insole_-43675673-01KWZYYG18N9FKJTAVG7J51MPM-01KYGYFP5FCNG8XP819V450Z3F.webp`,
      `${DOMAIN}/Yonex-AC195EX-Power-Cushion-Plus-Insole_-43675519-01KWZYYG18SH3K57VWM77MGE3E-01KYGYFPQB076H5YH209STGFC9.webp`,
      `${DOMAIN}/Yonex-AC195EX-Power-Cushion-Plus-Insole_-191740549-01KWZYYG19JKNZGMMWAAQESP0A-01KYGYFQ6SYWGMSZ1TZ6P4DKG4.webp`,
    ],
  },
  "yonex-pro-bag-92026": {
    thumbnail: `${DOMAIN}/yonex_92026_badminton_bag_blue_607x607-01KWZYPWP4SXQAEZ6ZTDNA012C-01KYGYFR3WZSWAPANHGYQZJT6S.webp`,
    images: [
      `${DOMAIN}/yonex_92026_badminton_bag_blue_607x607-01KWZYPWP4SXQAEZ6ZTDNA012C-01KYGYFR3WZSWAPANHGYQZJT6S.webp`,
    ],
  },
  "yonex-socks-19120": {
    thumbnail: `${DOMAIN}/19121-vo-01KWZXQW2YM6Z3Q6AMQ91YDX0Y-01KYGYFRK0SFZW8YJ6TSJXCATD.webp`,
    images: [
      `${DOMAIN}/19121-vo-01KWZXQW2YM6Z3Q6AMQ91YDX0Y-01KYGYFRK0SFZW8YJ6TSJXCATD.webp`,
    ],
  },
  "yonex-super-grap-ac104": {
    thumbnail: `${DOMAIN}/YonexAC104EXWaveGrapSyntheticBadmintonTennisOvergrip-01KWZYAPW097PE7EKTAJKDQ3M1-01KYGYFSY0XKQ4EATZ0P6N7XT0.webp`,
    images: [
      `${DOMAIN}/Yonex-AC104EX-Wave-Grap-Synthetic-Badminton-Tennis-Overgrip_-43547979-01KWZYAPW0NN731KNK5EDHDR5S-01KYGYFS0EQT52RBQ5C2VEX65B.webp`,
      `${DOMAIN}/Yonex-AC104EX-Wave-Grap-Synthetic-Badminton-Tennis-Overgrip_-43547835-01KWZYAPW0WDXEKXEBQ67S53HC-01KYGYFSH36HHA7M9744BMJ7CY.webp`,
      `${DOMAIN}/YonexAC104EXWaveGrapSyntheticBadmintonTennisOvergrip-01KWZYAPW097PE7EKTAJKDQ3M1-01KYGYFSY0XKQ4EATZ0P6N7XT0.webp`,
    ],
  },
};
