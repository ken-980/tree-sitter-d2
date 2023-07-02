# tree-sitter-d2

This is an alternative to pleshevskiy's [tree-sitter-d2](https://github.com/pleshevskiy/tree-sitter-d2) ([updated version](https://git.pleshevski.ru/pleshevskiy/tree-sitter-d2)).

**WIP, THIS IS NOT USABLE YET**, but you can check the progress at `dev` branch.

## There's an alternative, why?

pleshivsky's version handles other locales and spaces very poorly.

Markdown is just a mess:
![](./img/bad_example_1.png)

Missing highlighting on `style` block, ID and cyrillic using differeny scopes. Second shape (`Заказ`) is parsed as `ERROR`, but it's obviously correct.
![](./img/bad_example_2.png)

## Note

I've never done anything remotely close to parsing grammar, so there could be some bad patterns and simply bad code. Feel free to open issues.
