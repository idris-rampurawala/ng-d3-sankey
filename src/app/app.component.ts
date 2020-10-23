import { Subject } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';

import * as d3 from 'd3';
import * as d3Sankey from 'd3-sankey';

import { UserFlowService } from './user-flow.service';
import { UserFlow } from './models/user-flow';


const DROPOUT_NODE_NAME = 'dropout';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  private unsubscribeAll: Subject<any>;

  // user flow
  userFlowData: UserFlow;
  isUfCollapsed = false;
  isFetchingUserFlowData = false;

  constructor(
    private ngZone: NgZone,
    private userFlowService: UserFlowService
  ) {
    this.userFlowData = new UserFlow();
    window['ue'] = window['ue'] || {};
    window['ue']['userFlow'] = window['ue']['userFlow'] || {};
    window['ue']['userFlow'].publicFunc = this.publicFunc.bind(this);
  }

  ngOnInit(): void {
    this.loadData();
  }

  /* This will call API and load data */
  loadData(): void {
    this.isFetchingUserFlowData = true;
    // call API
    this.userFlowService.fetchUserFlowData()
      .pipe(
        delay(2000)
      )
      .subscribe((data: any) => {
        console.log(data);
        this.userFlowData.nodes = data['resource'][0]['userFlowData']['nodes'];
        this.userFlowData.links = data['resource'][0]['userFlowData']['links'];
        if (this.userFlowData.nodes.length) {
          this.drawChart(this.userFlowData);
        }
        this.isFetchingUserFlowData = false;
      }, (error: any) => {
        console.log(error);
        this.isFetchingUserFlowData = false;
      });
  }

  drawChart(chartData: UserFlow): void {
    const sankeyTemp = d3Sankey.sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .nodeAlign(d3Sankey.sankeyLeft)
      .extent([[1, 1], [100, 100]]);
    sankeyTemp(chartData);
    const iterTemp = d3.nest()
      .key(function (d: any) { return d.x0; })
      .sortKeys(d3.ascending)
      .entries(chartData.nodes)
      .sort(function (a: any, b: any) { return a.key - b.key; });
    if (iterTemp.length && iterTemp[iterTemp.length - 1].values[0].name.toLowerCase() === DROPOUT_NODE_NAME) {
      iterTemp.pop();
    }

    const interactions = iterTemp.length;
    const height = 500;
    const width = interactions * 320;

    const sankey = d3Sankey.sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .nodeAlign(d3Sankey.sankeyLeft)
      .extent([[1, 1], [width, height]]);
    sankey(chartData);

    const iter = d3.nest()
      .key(function (d: any) { return d.x0; })
      .sortKeys(d3.ascending)
      .entries(chartData.nodes)
      .map(function (d: any) { return d.key; })
      .sort(function (a: any, b: any) { return a - b; });

    const formatNumber = d3.format(',.0f');
    const format = function (d: any): string { return formatNumber(d) + ' session(s)'; };
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // reset data
    d3.selectAll('#sankey > *').remove();

    // add svg for header
    const svgHeader = d3.select('#sankey').append('svg');
    if (interactions <= 4) {
      svgHeader
        .attr('width', width + 50)
        .attr('height', '20');
    } else {
      svgHeader
        .attr('width', width)
        .attr('height', '20');
    }

    svgHeader.append('g').selectAll('text')
      .data(iter).enter()
      .append('text')
      .attr('font-size', 10)
      .attr('font-weight', 'bold')
      .attr('transform', function (d, i) { return 'translate(' + d + ', 10)'; })
      .text(function (d, i) {
        if (i < interactions) {
          return formatInteraction(i + 1) + ' interaction';
        } else { return ''; }
      });

    // add svg for graph
    const svg = d3.select('#sankey').append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewbox', `0 0 ${width} ${height}`);

    // add in the links
    const link = svg.append('g')
      .selectAll('.link')
      .data(chartData.links)
      .enter()
      .filter(function (l: any) {
        return l.target.name.toLowerCase() !== DROPOUT_NODE_NAME;
      })
      .append('path')
      .attr('d', d3Sankey.sankeyLinkHorizontal()
      )
      .attr('fill', 'none')
      .attr('stroke', '#9e9e9e')
      .style('opacity', '0.7')
      .attr('stroke-width', function (d: any) {
        return Math.max(1, d.width);
      })
      .attr('class', 'link')
      .sort(function (a: any, b: any) {
        if (a.target.name.toLowerCase() === DROPOUT_NODE_NAME) {
          return -1;
        } else if (b.target.name.toLowerCase() === DROPOUT_NODE_NAME) {
          return 1;
        } else {
          return 0;
        }
      })
      ;

    const dropLink = svg.append('g')
      .selectAll('.link')
      .data(chartData.links)
      .enter()
      .filter(function (l: any) {
        return l.target.name.toLowerCase() === DROPOUT_NODE_NAME;
      })

      .append('rect')
      .attr('x', function (d: any) {
        return d.source.x1;
      })
      .attr('y', function (d: any) {
        if (d.source.drop > 0) {
          let totalWidth = 0;
          for (let index = 0; index < d.source.sourceLinks.length; index++) {
            const elm = d.source.sourceLinks[index];
            if (elm.target.name.toLowerCase() === DROPOUT_NODE_NAME) {
              break;
            } else if (elm.value >= d.source.drop && elm.target.name.toLowerCase() !== DROPOUT_NODE_NAME) {
              totalWidth += elm.width;
            }
          }
          return d.source.y0 + totalWidth;
        } else {
          return d.source.y0;
        }
      })
      .attr('height', function (d: any) { return Math.abs(d.target.y0 - d.target.y1); })
      .attr('width', function (d: any) { return sankey.nodeWidth() + 3; })
      .attr('fill', '#f44336')
      .attr('stroke', '#f44336')
      .attr('class', 'dropout-node')
      .on('click', function (l: any) {
        console.log('dropout clicl', l);
        fnOnDropOutLinkClicked(l);
      });

    dropLink.append('title')
      .text(function (d: any) {
        return d.source.name + '\n' +
          'Dropouts ' + format(d.value);
      });

    // add the link titles
    link.append('title')
      .text(function (d: any) {
        return d.source.name + ' → ' +
          d.target.name + '\n' + format(d.value);
      });

    const node = svg.append('g').selectAll('.node')
      .data(chartData.nodes)
      .enter().append('g')
      .attr('class', 'node')
      .on('mouseover', fade(1))
      .on('mouseout', fade(0.7))
      .on('click', function (d) {
        console.log('node clicked', d);
        fnOnNodeClicked(d);
      });

    node.append('rect')
      .filter(function (d: any) {
        return d.name.toLowerCase() !== DROPOUT_NODE_NAME;
      })
      .attr('x', function (d: any) { return d.x0; })
      .attr('y', function (d: any) { return d.y0; })
      .attr('height', function (d: any) { return d.y1 - d.y0; })
      .attr('width', function (d: any) { return d.x1 - d.x0; })
      .attr('fill', '#2196f3')
      .append('title')
      .text(function (d: any) { return d.name + '\n' + format(d.value); });

    node.append('text')
      .filter(function (d: any) {
        return d.name.toLowerCase() !== DROPOUT_NODE_NAME;
      })
      .attr('x', function (d: any) { return d.x1 + 20; })
      .attr('y', function (d: any) { return (d.y1 + d.y0) / 2; })
      .attr('dy', '0.35em')
      .attr('font-size', 10)
      .attr('font-family', 'Roboto')
      .attr('text-anchor', 'end')
      .text(function (d: any) { return truncateText(d.name, 20); })
      .attr('text-anchor', 'start')
      .append('title')
      .text(function (d: any) { return d.name; });

    // miscellaneous functions
    function fade(opacity: any) {
      return function (g, i) {

        svg.selectAll('.link')
          .filter(function (d: any) { return d.source.node !== chartData.nodes[i].node && d.target.node !== chartData.nodes[i].node; })
          .transition()
          .style('opacity', opacity);
      };
    }

    function formatInteraction(num: number) {
      const lastDigit = num % 10;
      switch (lastDigit) {
        case 1:
          return `${num}st`;
        case 2:
          return `${num}nd`;
        case 3:
          return `${num}rd`;
        default:
          return `${num}th`;
      }
    }

    function fnOnDropOutLinkClicked(dropOutLink: any) {
      window['ue']['userFlow'].publicFunc(dropOutLink.target);
    }

    function fnOnNodeClicked(clickedNode: any) {
      window['ue']['userFlow'].publicFunc(clickedNode);
    }

    function truncateText(value: any, limit: number) {
      return value ? (value.length > limit) ? String(value).substr(0, limit - 1) + '...' : value : '';
    }

  }

  publicFunc(node: any): void {
    this.ngZone.run(() => this.nodeClicked(node));
  }

  nodeClicked(node: any): void {
    console.log('nodeClicked called', node);
    window.scrollTo(0, 0);
  }


  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.unsubscribeAll.next();
    this.unsubscribeAll.complete();
    window['ue']['userFlow'].publicFunc = null;
  }

}
