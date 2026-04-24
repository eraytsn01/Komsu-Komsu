

declare const DaskService: {
  adresVerisiCek: (
    tip: 'il' | 'ilce' | 'mahalle' | string,
    kod: string
  ) => Promise<any[]>;
};
export default DaskService;
