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
    // creating window functions to interact with external js functions i.e. sankey chart
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
        delay(1000)
      )
      .subscribe((data: UserFlow) => {
        this.userFlowData.nodes = data.nodes;
        this.userFlowData.links = data.links;
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
    // creating a temporary sankey plot to identify the interactions for height and width calculation of viewport
    const sankeyTemp = d3Sankey.sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .nodeAlign(d3Sankey.sankeyLeft)
      .extent([[1, 1], [100, 100]]);
    sankeyTemp(chartData);
    const iterTemp = d3.nest()
      .key((d: any) => d.x0)
      .sortKeys(d3.ascending)
      .entries(chartData.nodes)
      .sort((a: any, b: any) => a.key - b.key);
    if (iterTemp.length && iterTemp[iterTemp.length - 1].values[0].name.toLowerCase() === DROPOUT_NODE_NAME) {
      iterTemp.pop();
    }

    const interactions = iterTemp.length;
    const height = 500;
    const width = interactions * 320;

    // plotting the sankey chart
    const sankey = d3Sankey.sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .nodeAlign(d3Sankey.sankeyLeft)
      .extent([[1, 1], [width, height]]);
    sankey(chartData);

    const iter = d3.nest()
      .key((d: any) => d.x0)
      .sortKeys(d3.ascending)
      .entries(chartData.nodes)
      .map((d: any) => d.key)
      .sort((a: any, b: any) => a - b);

    const formatNumber = d3.format(',.0f');
    const format = (d: any): string => formatNumber(d) + ' session(s)';
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // reset data
    d3.selectAll('#sankey > *').remove();

    // add svg for header for showing interaction counts
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
      .attr('transform', (d, i) => 'translate(' + d + ', 10)')
      .text((d, i) => {
        if (i < interactions) {
          return formatInteraction(i + 1) + ' interaction';
        } else { return ''; }
      });

    // add svg for graph
    const svg = d3.select('#sankey').append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewbox', `0 0 ${width} ${height}`);

    // add in the links (excluding the dropouts, coz it will become node)
    const link = svg.append('g')
      .selectAll('.link')
      .data(chartData.links)
      .enter()
      .filter((l: any) => l.target.name.toLowerCase() !== DROPOUT_NODE_NAME)
      .append('path')
      .attr('d', d3Sankey.sankeyLinkHorizontal()
      )
      .attr('fill', 'none')
      .attr('stroke', '#9e9e9e')
      .style('opacity', '0.7')
      .attr('stroke-width', (d: any) => Math.max(1, d.width))
      .attr('class', 'link')
      .sort((a: any, b: any) => {
        if (a.target.name.toLowerCase() === DROPOUT_NODE_NAME) {
          return -1;
        } else if (b.target.name.toLowerCase() === DROPOUT_NODE_NAME) {
          return 1;
        } else {
          return 0;
        }
      })
      ;

    // plotting dropout nodes
    const dropLink = svg.append('g')
      .selectAll('.link')
      .data(chartData.links)
      .enter()
      .filter((l: any) => l.target.name.toLowerCase() === DROPOUT_NODE_NAME)
      .append('rect')
      .attr('x', (d: any) => d.source.x1)
      .attr('y', (d: any) => {
        if (d.source.drop > 0) {
          let totalWidth = 0;
          for (const elm of d.source.sourceLinks) {
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
      .attr('height', (d: any) => Math.abs(d.target.y0 - d.target.y1))
      .attr('width', (d: any) => sankey.nodeWidth() + 3)
      .attr('fill', '#f44336')
      .attr('stroke', '#f44336')
      .attr('class', 'dropout-node')
      .on('click', (l: any) => {
        fnOnDropOutLinkClicked(l);
      });

    dropLink.append('title')
      .text((d: any) => d.source.name + '\n' +
        'Dropouts ' + format(d.value));

    // add the link titles
    link.append('title')
      .text((d: any) => d.source.name + ' → ' +
        d.target.name + '\n' + format(d.value));

    // plotting the nodes
    const node = svg.append('g').selectAll('.node')
      .data(chartData.nodes)
      .enter().append('g')
      .attr('class', 'node')
      .on('mouseover', fade(1))
      .on('mouseout', fade(0.7))
      .on('click', (d) => {
        fnOnNodeClicked(d);
      });

    node.append('rect')
      .filter((d: any) => d.name.toLowerCase() !== DROPOUT_NODE_NAME)
      .attr('x', (d: any) => d.x0)
      .attr('y', (d: any) => d.y0)
      .attr('height', (d: any) => d.y1 - d.y0)
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('fill', '#2196f3')
      .append('title')
      .text((d: any) => d.name + '\n' + format(d.value));

    node.append('text')
      .filter((d: any) => d.name.toLowerCase() !== DROPOUT_NODE_NAME)
      .attr('x', (d: any) => d.x1 + 20)
      .attr('y', (d: any) => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('font-size', 10)
      .attr('font-family', 'Roboto')
      .attr('text-anchor', 'end')
      .text((d: any) => truncateText(d.name, 20))
      .attr('text-anchor', 'start')
      .append('title')
      .text((d: any) => d.name);

    /* miscellaneous functions */

    // function to fade other links on hove of a node
    function fade(opacity: any): any {
      return (g, i) => {

        svg.selectAll('.link')
          .filter((d: any) => d.source.node !== chartData.nodes[i].node && d.target.node !== chartData.nodes[i].node)
          .transition()
          .style('opacity', opacity);
      };
    }

    // function to format the interaction number
    function formatInteraction(num: number): string {
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

    // function gets called on click of a dropout node
    function fnOnDropOutLinkClicked(dropOutLink: any): void {
      window['ue']['userFlow'].publicFunc(dropOutLink.target, true);
    }

    // function gets called on click of a node
    function fnOnNodeClicked(clickedNode: any): void {
      window['ue']['userFlow'].publicFunc(clickedNode);
    }

    // common util function to truncate text
    function truncateText(value: any, limit: number): string {
      return value ? (value.length > limit) ? String(value).substr(0, limit - 1) + '...' : value : '';
    }

  }

  // window function that's called from D3 and internally calls angular function
  publicFunc(node: any, isDropout = false): void {
    this.ngZone.run(() => this.nodeClicked(node, isDropout));
  }

  nodeClicked(node: any, isDropout: boolean): void {
    if (isDropout) {
      console.log('dropout node clicked', node);
    } else {
      console.log('node clicked', node);
    }
  }


  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.unsubscribeAll.next();
    this.unsubscribeAll.complete();
    window['ue']['userFlow'].publicFunc = null;
  }

}
