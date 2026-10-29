<?php

declare(strict_types=1);

namespace Andersundsehr\Storybook\Tests\Unit\Factory;

use Andersundsehr\Storybook\Dto\ComponentData;
use Andersundsehr\Storybook\Dto\RenderJob;
use Andersundsehr\Storybook\Dto\ViewHelperName;
use Andersundsehr\Storybook\Factory\ComponentDataFactory;
use Andersundsehr\Storybook\Service\ConfigService;
use Andersundsehr\Storybook\Transformer\Transformers;
use Psr\Http\Message\ServerRequestInterface;
use RuntimeException;
use TYPO3\CMS\Core\Site\Entity\Site;
use TYPO3\TestingFramework\Core\Unit\UnitTestCase;
use TYPO3Fluid\Fluid\Core\Component\ComponentDefinition;
use TYPO3Fluid\Fluid\Core\Rendering\RenderingContext;
use TYPO3Fluid\Fluid\Core\ViewHelper\ArgumentDefinition;

final class ComponentDataFactoryTest extends UnitTestCase
{
    public function testSlotContentIsPassedThroughByDefault(): void
    {
        $componentData = $this->transform(false, ['slot____default' => 'Hello {name}']);

        self::assertSame('Hello {name}', $componentData->slots['default']());
    }

    public function testSlotContentIsRenderedAsFluidInTheRenderingContextWhenEnabled(): void
    {
        $renderingContext = new RenderingContext();
        $renderingContext->getVariableProvider()->add('name', 'World');

        $componentData = $this->transform(
            true,
            ['slot____default' => 'Hello {name}', 'slot____footer' => '<f:if condition="{name}">{name}</f:if>'],
            $renderingContext,
        );

        self::assertSame('Hello World', $componentData->slots['default']());
        self::assertSame('World', $componentData->slots['footer']());
    }

    public function testArrayArgumentsReachTheComponentAsTheyAre(): void
    {
        $items = ['first', 'nested' => ['flag' => true, 'count' => 2]];

        $componentData = $this->transform(false, ['items' => $items, 'title' => 'Hello']);

        self::assertSame(['items' => $items, 'title' => 'Hello'], $componentData->arguments);
    }

    public function testArraySlotContentIsRejected(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(3177405166);

        $this->transform(false, ['slot____default' => ['not', 'fluid']]);
    }

    public function testFluidErrorsNameTheSlot(): void
    {
        $componentData = $this->transform(true, ['slot____footer' => '</f:if>']);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(4382910475);
        $this->expectExceptionMessageMatches('/slot "footer"/');

        $componentData->slots['footer']();
    }

    /**
     * @param array<string, mixed> $rawArgs
     */
    private function transform(bool $renderSlotsAsFluid, array $rawArgs, ?RenderingContext $renderingContext = null): ComponentData
    {
        $configService = $this->createStub(ConfigService::class);
        $configService->method('renderSlotsAsFluid')->willReturn($renderSlotsAsFluid);

        $site = new Site('test', 1, ['base' => '/']);
        $renderJob = new RenderJob(
            new ViewHelperName('test:component'),
            $site,
            $site->getDefaultLanguage(),
            $this->createStub(ServerRequestInterface::class),
            $rawArgs,
            '/',
            'test',
        );

        return (new ComponentDataFactory($configService))->transform(
            new ComponentDefinition(
                'component',
                [
                    'items' => new ArgumentDefinition('items', 'array', 'The items', false),
                    'title' => new ArgumentDefinition('title', 'string', 'The title', false),
                ],
                false,
                ['default', 'footer'],
            ),
            new Transformers([], 'none'),
            $renderJob,
            $renderingContext ?? new RenderingContext(),
        );
    }
}
