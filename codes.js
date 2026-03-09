// codes.js — StoryLex Access Codes (KEEP THIS PRIVATE — add to .gitignore)
// These are your 100 one-time-use access codes.
// Each code can only be activated once. Once used, it is burned and cannot be reused.
// The "used" state is stored in the buyer's browser (localStorage).
// To track which codes you've sold, keep a note in your own records.
//
// FORMAT: 4 letters + 4 numbers (e.g. SGFB3863)
// Hand one code to each buyer. They enter it once; after that their browser remembers them.

const VALID_CODES = [
  "RQVU0288", "BULS9688", "KHCU3388", "DPFJ8688", "TPPM8688",
  "DZXA8388", "LBXC5988", "JQGE8088", "NWLC9288", "SCRU3988",
  "EUZR8688", "YJUJ8288", "RTFV8088", "BRDZ7588", "STYC6088",
  "SVKT6988", "SJKT0788", "CSMY3388", "PZEK5888", "TQAJ2088",
  "BXDP0088", "DRRM8588", "CXUD8288", "LGUN0388", "CJCB8088",
  "TRXR0888", "CUWU2588", "JBAG0688", "TLEF5088", "ZFQG0988",
  "UNTN3588", "LAEU9088", "YBZQ8588", "NQKE3588", "YFAC2588",
  "UUAL7288", "YCEP6888", "UGCB3688", "FMWN2988", "NTKX8788",
  "SPVK8988", "UZDR0388", "JQHK8988", "YFYZ8088", "XPDX9888",
  "UWVG0288", "SLUX0688", "XHNM6088", "XBDF9088", "YZTX0688",
  "GSQP0088", "JHXY5688", "QWWS0288", "PVVK2088", "NSGH0288",
  "ZWTA2088", "XZWP7088", "DUQX2888", "PNFB0088", "JYTB5288",
  "RVYX0588", "EKSW2088", "HMXV8888", "NVKM7388", "XZTC6788",
  "CATV3688", "MFEG0588", "UEXQ0988", "GMJJ8388", "BCTU2088",
  "WKNY8688", "XQZN5088", "NCGA0088", "KCNM3088", "XKZG8288",
  "RUFL9988", "QQUU6088", "DCTQ8088", "JJYX5788", "AYYE9088",
  "DUKG0988", "RZZK8388", "DVTR6988", "ZKSH9888", "EPPT6088",
  "RPYY6288", "JBLA5788", "XDNJ0988", "CNKU0088", "RFFD0988",
  "NUNF9288", "CNXT2288", "SJMR8688", "KLLP3388", "QTKB0588",
  "RCKA3288", "CXQZ9888", "URBM6388", "KKKQ3888", "VAKE9288"
];
