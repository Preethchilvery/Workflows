document.addEventListener('DOMContentLoaded', () => {
    // Tab handling
    const tabBtns = document.querySelectorAll('.tab-btn');
    const diagrams = document.querySelectorAll('.diagram');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.tab;
            
            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update diagrams
            diagrams.forEach(d => d.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Shared state
    let lpCount = 3;
    const MIN_LP_COUNT = 2;
    const MAX_LP_COUNT = 8;
    const NODE_RADIUS = 35;

    // Create both visualizations
    const vis1 = createVisualization('workflow-visualization-1', false);
    const vis2 = createVisualization('workflow-visualization-2', true);

    function createVisualization(containerId, includeExtraTaker = false) {
        const container = document.getElementById(containerId);
        const width = container.clientWidth;
        const height = container.clientHeight;
        let animationInterval = null;

        // Create SVG container
        const svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Initialize nodes and links
        let nodes = [];
        let links = [];

        function updateNodesAndLinks() {
            const takerX = width * (includeExtraTaker ? 0.35 : 0.2);
            const makerX = width * (includeExtraTaker ? 0.65 : 0.5);
            const lpX = width * (includeExtraTaker ? 0.85 : 0.8);
            const centerY = height * 0.5;
            const verticalOffset = 20; // Offset for request/price paths

            // Calculate LP vertical positions
            const lpSpacing = Math.min(150, (height - 200) / (lpCount + 1));
            const totalLpHeight = (lpCount - 1) * lpSpacing;
            const lpStartY = centerY - (totalLpHeight / 2);

            // Create nodes
            nodes = [
                { id: 'taker', label: 'Market Taker (TEX)', type: 'user', x: takerX, y: centerY },
                { id: 'maker', label: 'Market Maker (TEX)', type: 'user', x: makerX, y: centerY }
            ];

            // Add extra taker for second diagram
            if (includeExtraTaker) {
                nodes.unshift({
                    id: 'external-taker',
                    label: 'Market Taker (ITEX)',
                    type: 'user',
                    x: width * 0.15,
                    y: centerY
                });

                // Update maker label to include /Market Taker
                nodes.find(n => n.id === 'maker').label = 'Market Maker/Market Taker (TEX)';
            }

            // Add LP nodes
            for (let i = 0; i < lpCount; i++) {
                nodes.push({
                    id: `lp${i + 1}`,
                    label: `Liquidity Provider ${i + 1}`,
                    type: 'bank',
                    x: lpX,
                    y: lpStartY + (i * lpSpacing)
                });
            }

            // Create links with offset paths for request/price
            links = [
                // Request path (slightly above center)
                { source: 'taker', target: 'maker', label: 'REQUEST', multiplicity: includeExtraTaker ? '' : '1:n', offset: -verticalOffset },
                // Price path (slightly below center)
                { source: 'maker', target: 'taker', label: 'PRICE', offset: verticalOffset }
            ];

            // Add extra taker links for second diagram
            if (includeExtraTaker) {
                links.unshift(
                    // External request path (above)
                    { source: 'external-taker', target: 'taker', label: 'REQUEST', multiplicity: '1:1', offset: -verticalOffset },
                    // External price path (below, same offset as other price paths)
                    { source: 'taker', target: 'external-taker', label: 'PRICE', margin: '+Margin (optional)', offset: verticalOffset }
                );

                // Update maker's request path to show 1:n
                links.find(l => l.source === 'taker' && l.target === 'maker').multiplicity = '1:n';
            }

            // Add LP links - single line per LP, no offset
            for (let i = 1; i <= lpCount; i++) {
                links.push({ source: 'maker', target: `lp${i}`, label: '', offset: 0 });
            }

            updateVisualization();
        }

        function calculatePath(source, target, offset = 0) {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const angle = Math.atan2(dy, dx);

            // Calculate start and end points with NODE_RADIUS offset
            let sourceX = source.x + (NODE_RADIUS * Math.cos(angle));
            let sourceY = source.y + (NODE_RADIUS * Math.sin(angle)) + offset;
            let targetX = target.x - (NODE_RADIUS * Math.cos(angle));
            let targetY = target.y - (NODE_RADIUS * Math.sin(angle)) + offset;

            return {
                path: `M${sourceX},${sourceY} L${targetX},${targetY}`,
                fullPath: `M${sourceX},${sourceY} L${targetX},${targetY}`,
                angle: angle * (180 / Math.PI)
            };
        }

        function updateVisualization() {
            // Update nodes
            const nodeElements = svg.selectAll('.node-group')
                .data(nodes, d => d.id);

            nodeElements.exit().remove();

            const nodeEnter = nodeElements.enter()
                .append('g')
                .attr('class', 'node-group');

            nodeEnter.append('circle')
                .attr('class', d => `node ${d.type}`)
                .attr('r', NODE_RADIUS);

            nodeEnter.append('text')
                .attr('class', 'node-icon')
                .attr('text-anchor', 'middle')
                .attr('dy', '0.35em')
                .text(d => d.type === 'bank' ? '🏦' : '👤');

            nodeEnter.append('text')
                .attr('class', 'node-text')
                .attr('dy', '4em')
                .text(d => d.label);

            const allNodes = nodeEnter.merge(nodeElements)
                .transition()
                .duration(500)
                .attr('transform', d => `translate(${d.x},${d.y})`);

            // Update links
            const linkElements = svg.selectAll('.link')
                .data(links, d => d.source + d.target + (d.label || ''));

            linkElements.exit().remove();

            const linkEnter = linkElements.enter()
                .append('path')
                .attr('class', 'link');

            const allLinks = linkEnter.merge(linkElements);
            
            allLinks.each(function(d) {
                const source = nodes.find(n => n.id === d.source);
                const target = nodes.find(n => n.id === d.target);
                const pathData = calculatePath(source, target, d.offset);
                
                d.pathForAnimation = pathData.fullPath;
                
                d3.select(this)
                    .transition()
                    .duration(500)
                    .attr('d', pathData.path);
            });

            // Update link labels and multiplicity
            const linkTexts = svg.selectAll('.link-text-group')
                .data(links.filter(l => l.label), d => d.source + d.target + d.label);

            linkTexts.exit().remove();

            const linkTextEnter = linkTexts.enter()
                .append('g')
                .attr('class', 'link-text-group');

            // Add label
            linkTextEnter.append('text')
                .attr('class', 'link-label');

            // Add multiplicity if present
            linkTextEnter.append('text')
                .attr('class', 'link-multiplicity')
                .attr('dy', '-1em');  // Position above the link label

            const allLinkTexts = linkTextEnter.merge(linkTexts);
            
            allLinkTexts.each(function(d) {
                const source = nodes.find(n => n.id === d.source);
                const target = nodes.find(n => n.id === d.target);
                const x = (source.x + target.x) / 2;
                const y = ((source.y + target.y) / 2) + d.offset;

                const group = d3.select(this);

                // Remove any existing margin text
                group.selectAll('.margin-text').remove();

                // Update label
                group.select('.link-label')
                    .attr('x', x)
                    .attr('y', y)
                    .text(d.label);

                // Update multiplicity if present
                group.select('.link-multiplicity')
                    .attr('x', x)
                    .attr('y', y - 20)  // Position further above the link label
                    .text(d.multiplicity || '');

                // Add margin text if present
                if (d.margin) {
                    group.append('text')
                        .attr('class', 'margin-text')
                        .attr('x', x)
                        .attr('y', y + 15)  // Closer to the PRICE text
                        .attr('text-anchor', 'middle')  // Ensure center alignment
                        .attr('dominant-baseline', 'hanging')  // Align from the top
                        .text(d.margin);
                }
            });

            // Update LP links - single line per LP, no offset
            const lpLinkElements = svg.selectAll('.lp-link')
                .data(links.filter(l => l.source === 'maker' && l.target.startsWith('lp')), d => d.source + d.target);

            lpLinkElements.exit().remove();

            const lpLinkEnter = lpLinkElements.enter()
                .append('path')
                .attr('class', 'lp-link');

            lpLinkEnter.merge(lpLinkElements)
                .each(function(d) {
                    const source = nodes.find(n => n.id === d.source);
                    const target = nodes.find(n => n.id === d.target);
                    const pathData = calculatePath(source, target);
                    
                    d3.select(this)
                        .transition()
                        .duration(500)
                        .attr('d', pathData.path);
                });
        }

        // Animation functions
        function animateDataFlow() {
            return new Promise((resolve) => {
                svg.selectAll('.moving-dot').remove();

                let animations = [];
                
                if (includeExtraTaker) {
                    // 1. External Taker -> Taker
                    const externalPath = svg.selectAll('.link').filter(d => 
                        d.source === 'external-taker' && d.target === 'taker' && d.label === 'REQUEST');
                    animations.push(animateAlongPath(externalPath, 1500));
                }

                // 2. Taker -> Maker
                const requestPath = svg.selectAll('.link').filter(d => 
                    d.source === 'taker' && d.target === 'maker' && d.label === 'REQUEST');
                
                animations.push(
                    Promise.all(animations)
                        .then(() => animateAlongPath(requestPath, 1500))
                        .then(() => {
                            // 3. Maker -> LPs (all requests together)
                            const lpLinks = links.filter(l => 
                                l.source === 'maker' && l.target.startsWith('lp')
                            );
                            
                            // Send all requests simultaneously
                            const requestAnimations = lpLinks.map(lpLink => {
                                const lpPath = svg.selectAll('.link').filter(d => 
                                    d.source === lpLink.source && 
                                    d.target === lpLink.target
                                );
                                return animateAlongPath(lpPath, 800);
                            });

                            return Promise.all(requestAnimations)
                                .then(() => {
                                    // After all requests arrive, send all responses simultaneously
                                    const responseAnimations = lpLinks.map(lpLink => {
                                        const lpPath = svg.selectAll('.link').filter(d => 
                                            d.source === lpLink.source && 
                                            d.target === lpLink.target
                                        );
                                        return animateAlongPath(lpPath, 800, true);
                                    });
                                    return Promise.all(responseAnimations);
                                });
                        })
                        .then(() => {
                            // 4. Maker -> Taker
                            const pricePath = svg.selectAll('.link').filter(d => 
                                d.source === 'maker' && d.target === 'taker' && d.label === 'PRICE');
                            return animateAlongPath(pricePath, 1500);
                        })
                        .then(() => {
                            if (includeExtraTaker) {
                                // 5. Taker -> External Taker
                                const externalResponsePath = svg.selectAll('.link').filter(d => 
                                    d.source === 'taker' && 
                                    d.target === 'external-taker' && 
                                    d.label === 'PRICE');
                                return animateAlongPath(externalResponsePath, 1500);
                            }
                        })
                );

                Promise.all(animations).then(resolve);
            });
        }

        function animateAlongPath(path, duration, reverse = false) {
            return new Promise(resolve => {
                if (!path.node()) {
                    resolve();
                    return;
                }

                const dot = svg.append('circle')
                    .attr('class', 'moving-dot')
                    .attr('r', 6);

                const pathNode = path.node();
                const pathLength = pathNode.getTotalLength();

                dot.transition()
                    .duration(duration)
                    .attrTween('transform', () => t => {
                        const progress = reverse ? 1 - t : t;
                        const point = pathNode.getPointAtLength(progress * pathLength);
                        return `translate(${point.x},${point.y})`;
                    })
                    .on('end', () => {
                        dot.remove();
                        resolve();
                    });
            });
        }

        // Animation control functions
        function startAnimation() {
            if (!animationInterval) {
                const stopBtn = document.getElementById(`stopBtn${containerId.slice(-1)}`);
                const initiateBtn = document.getElementById(`initiateBtn${containerId.slice(-1)}`);
                
                stopBtn.classList.remove('disabled');
                stopBtn.disabled = false;
                initiateBtn.textContent = 'ANIMATION RUNNING...';
                initiateBtn.disabled = true;

                const runAnimation = () => {
                    if (!animationInterval) return;
                    animateDataFlow().then(() => {
                        if (animationInterval) {
                            animationInterval = setTimeout(runAnimation, 1000);
                        }
                    });
                };

                animationInterval = setTimeout(runAnimation, 0);
            }
        }

        function stopAnimation() {
            if (animationInterval) {
                clearTimeout(animationInterval);
                animationInterval = null;

                svg.selectAll('.moving-dot').remove();

                const stopBtn = document.getElementById(`stopBtn${containerId.slice(-1)}`);
                const initiateBtn = document.getElementById(`initiateBtn${containerId.slice(-1)}`);
                
                stopBtn.classList.add('disabled');
                stopBtn.disabled = true;
                initiateBtn.textContent = 'INITIATE REQUEST';
                initiateBtn.disabled = false;
            }
        }

        // Initialize visualization
        updateNodesAndLinks();

        // Return control functions
        return {
            updateNodesAndLinks,
            startAnimation,
            stopAnimation
        };
    }

    // LP controls for both diagrams
    document.getElementById('addLpBtn').addEventListener('click', () => {
        if (lpCount < MAX_LP_COUNT) {
            lpCount++;
            document.querySelectorAll('.lp-count').forEach(el => el.textContent = `${lpCount} LPs`);
            vis1.updateNodesAndLinks();
        }
    });

    document.getElementById('removeLpBtn').addEventListener('click', () => {
        if (lpCount > MIN_LP_COUNT) {
            lpCount--;
            document.querySelectorAll('.lp-count').forEach(el => el.textContent = `${lpCount} LPs`);
            vis1.updateNodesAndLinks();
        }
    });

    document.getElementById('addLpBtn2').addEventListener('click', () => {
        if (lpCount < MAX_LP_COUNT) {
            lpCount++;
            document.querySelectorAll('.lp-count').forEach(el => el.textContent = `${lpCount} LPs`);
            vis2.updateNodesAndLinks();
        }
    });

    document.getElementById('removeLpBtn2').addEventListener('click', () => {
        if (lpCount > MIN_LP_COUNT) {
            lpCount--;
            document.querySelectorAll('.lp-count').forEach(el => el.textContent = `${lpCount} LPs`);
            vis2.updateNodesAndLinks();
        }
    });

    // Animation controls for each diagram
    document.getElementById('initiateBtn1').addEventListener('click', vis1.startAnimation);
    document.getElementById('stopBtn1').addEventListener('click', vis1.stopAnimation);
    document.getElementById('initiateBtn2').addEventListener('click', vis2.startAnimation);
    document.getElementById('stopBtn2').addEventListener('click', vis2.stopAnimation);

    // Initialize button states
    document.getElementById('stopBtn1').classList.add('disabled');
    document.getElementById('stopBtn1').disabled = true;
    document.getElementById('stopBtn2').classList.add('disabled');
    document.getElementById('stopBtn2').disabled = true;

    // Update LP count displays
    document.querySelectorAll('.lp-count').forEach(el => el.textContent = `${lpCount} LPs`);

    // Make visualizations responsive
    window.addEventListener('resize', () => {
        vis1.updateNodesAndLinks();
        vis2.updateNodesAndLinks();
    });
});
