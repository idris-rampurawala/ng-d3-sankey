export class UserFlow {
  nodes: Array<any>;
  links: Array<any>;

  constructor() {
    this.nodes = [];
    this.links = [];
  }

  restructureLinkValByPercentile(): void {
    const maxNValue = Math.max.apply(Math, this.links.map(l => l.value));
    console.log(maxNValue);
    this.links.forEach(link => {
      link.value = Math.round((link.value / maxNValue) * 100);
    });
  }

}
